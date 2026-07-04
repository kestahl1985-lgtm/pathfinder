// Vula RIASEC assessment: questions, scoring, career/sponsor matching, and
// session persistence. Shared by every messaging provider (Twilio, Meta
// Cloud API, ...) — nothing in this file talks to a specific provider's
// send/receive API. A provider's webhook handler is expected to:
//   1. parse the inbound message into (phone, input, rawBody)
//   2. call loadSession / advance / saveSession
//   3. render the returned "pieces" (type: text|yesno|grade|consent|media|language)
//      using its own provider-specific message format
//
// Language: the learner picks one of lib/i18n.js's LANGUAGES as the very
// first step (session.data.lang), and everything conversational after that
// is looked up via i18n.t(lang, key, ...). Career content itself (name/why/
// subjects/qual in lib/careers.js) is NOT yet translated — that's a
// deliberate second phase, done only after the English career data has been
// through its counsellor/professional-body review, so translation work
// isn't wasted on data that's still going to change.

const https = require("https");
const crypto = require("crypto");

const { CAREERS, careerById } = require("./careers.js");
const { normalizeCity } = require("./cities.js");
const i18n = require("./i18n.js");

const PRIVACY_URL = process.env.PRIVACY_URL || "https://vulacareers.co.za/privacy.html";
const REPORT_BASE = process.env.PUBLIC_BASE_URL || "https://pathfinder-backend-one.vercel.app";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
const memory = {};

const langOf = (s) => (s.data && s.data.lang) || i18n.DEFAULT_LANG;

// Basic per-sender rate limit (defence in depth; the primary control is
// each provider's own request-signature check). In-memory, so it is only
// enforced per warm serverless instance, not globally.
const _rl = new Map();
function rateLimited(key) {
  const now = Date.now();
  const WINDOW = 60000;
  const MAX = 40; // messages per minute per sender
  const e = _rl.get(key) || { count: 0, start: now };
  if (now - e.start > WINDOW) { e.count = 0; e.start = now; }
  e.count += 1;
  _rl.set(key, e);
  return e.count > MAX;
}

// ===================== Assessment =====================
// 30 questions, 5 per trait, interleaved. Text is in lib/i18n.js
// (QUESTION_TEXT[lang][i]); only the trait letter lives here.
const QUESTION_TRAITS = [
  "R", "I", "A", "S", "E", "C",
  "R", "I", "A", "S", "E", "C",
  "R", "I", "A", "S", "E", "C",
  "R", "I", "A", "S", "E", "C",
  "R", "I", "A", "S", "E", "C",
];

function questionText(i, lang) {
  const text = (i18n.QUESTION_TEXT[lang] || i18n.QUESTION_TEXT[i18n.DEFAULT_LANG])[i];
  return `*Question ${i + 1} of ${QUESTION_TRAITS.length}*\n\n${text}`;
}

// Compute trait scores, top traits, and the top-6 matched careers.
function computeMatches(s) {
  const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  s.responses.forEach((a, i) => { scores[QUESTION_TRAITS[i]] += a; });
  s.data.scores = scores;
  s.data.top = Object.keys(scores).sort((a, b) => scores[b] - scores[a]).slice(0, 3);

  const ranked = CAREERS.map((c) => ({
    id: c.id,
    score: scores[c.traits[0]] * 2 + (c.traits[1] ? scores[c.traits[1]] : 0),
  })).sort((a, b) => b.score - a.score);

  s.data.matches = ranked.slice(0, 6).map((r) => r.id);
}

function gradeTip(grade, lang) {
  if (grade === 10) return i18n.t(lang, "gradeTip10");
  if (grade === 11) return i18n.t(lang, "gradeTip11");
  return i18n.t(lang, "gradeTip12");
}

// NOTE: career name/why/subjects/qual (from lib/careers.js) are still
// English-only pending the phase-2 translation described at the top of
// this file — only the surrounding UI text is localized here.
function resultsListText(s) {
  const lang = langOf(s);
  const ids = s.data.matches || [];
  const traitNames = i18n.TRAIT_NAMES[lang] || i18n.TRAIT_NAMES[i18n.DEFAULT_LANG];
  let text =
    `${i18n.t(lang, "yourTopStrengths")} ${s.data.top.map((x) => traitNames[x]).join(", ")}\n\n` +
    `${i18n.t(lang, "careersThatFit")}\n\n`;
  ids.forEach((id, i) => {
    const c = careerById(id);
    text += `*${i + 1}.* *${c.name}*\n     ${c.list}\n`;
  });
  text += i18n.t(lang, "exploreInstruction", ids.length);
  return text;
}

function menuText(s) {
  const lang = langOf(s);
  const ids = s.data.matches || [];
  let text = i18n.t(lang, "menuHeader");
  ids.forEach((id, i) => { text += `${i + 1}. ${careerById(id).name}\n`; });
  text += i18n.t(lang, "menuFooter");
  return text;
}

function careerDetailText(s, c) {
  const lang = langOf(s);
  const traitNames = i18n.TRAIT_NAMES[lang] || i18n.TRAIT_NAMES[i18n.DEFAULT_LANG];
  const tops = (s.data.top || []).slice(0, 2).map((x) => traitNames[x]);
  const strengths = tops.length ? `${tops.length > 1 ? `*${tops.join("* / *")}*` : `*${tops[0]}*`} — ` : "";
  return (
    `🎯 *${c.name}*\n\n` +
    `${i18n.t(lang, "careerWhy")} ${strengths}${c.why}\n\n` +
    `${i18n.t(lang, "careerSubjects")} ${c.subjects}\n\n` +
    `${i18n.t(lang, "careerQual")} ${c.qual}`
  );
}

// ===================== State machine =====================
async function advance(s, input, rawBody) {
  if (s.step === "language") {
    const choice = pickLanguage(input);
    if (!choice) return [{ type: "language" }];
    s.data.lang = choice;
    s.step = "consent";
    return [welcomePiece(s)];
  }

  const lang = langOf(s);

  if (s.step === "consent") {
    const v = (input || "").toLowerCase();
    if (v === "more") {
      return [{ type: "consent", text: i18n.t(lang, "moreInfo").replace("{privacyUrl}", PRIVACY_URL), buttons: i18n.t(lang, "consentButtons") }];
    }
    if (v === "agree" || v === "yes" || v === "i agree" || v.includes("agree")) {
      s.data.consent = true;
      s.data.consent_at = new Date().toISOString();
      s.step = "name";
      return [{ type: "text", text: i18n.t(lang, "askName") }];
    }
    return [{ type: "consent", text: i18n.t(lang, "consentRetry"), buttons: i18n.t(lang, "consentButtons") }];
  }

  if (s.step === "name") {
    s.data.name = rawBody.slice(0, 40);
    s.step = "school";
    return [{ type: "text", text: i18n.t(lang, "thankName", rawBody) }];
  }
  if (s.step === "school") {
    s.data.school = rawBody.slice(0, 60);
    s.step = "age";
    return [{ type: "text", text: i18n.t(lang, "thankSchool", rawBody) }];
  }
  if (s.step === "age") {
    const age = parseInt(input, 10);
    if (isNaN(age) || age < 12 || age > 25) return [{ type: "text", text: i18n.t(lang, "invalidAge") }];
    s.data.age = age;
    s.step = "city";
    return [{ type: "text", text: i18n.t(lang, "askCity") }];
  }
  if (s.step === "city") {
    s.data.city = normalizeCity(rawBody);
    s.step = "suburb";
    return [{ type: "text", text: i18n.t(lang, "askSuburb") }];
  }
  if (s.step === "suburb") {
    s.data.suburb = rawBody.slice(0, 40);
    s.step = "grade";
    return [{ type: "grade", text: i18n.t(lang, "askGrade", rawBody), buttons: i18n.t(lang, "gradeButtons") }];
  }
  if (s.step === "grade") {
    const grade = parseInt(input, 10);
    if (![10, 11, 12].includes(grade)) return [{ type: "grade", text: i18n.t(lang, "invalidGrade"), buttons: i18n.t(lang, "gradeButtons") }];
    s.data.grade = grade;
    s.step = "assessment";
    s.q = 0;
    return [
      { type: "text", text: i18n.t(lang, "assessmentIntro", s.data.name) },
      { type: "yesno", text: questionText(0, lang), buttons: i18n.t(lang, "yesnoButtons") },
    ];
  }

  if (s.step === "assessment") {
    const a = parseInt(input, 10);
    if (![0, 1, 2].includes(a)) return [{ type: "yesno", text: i18n.t(lang, "invalidAssessmentAnswer") + questionText(s.q, lang), buttons: i18n.t(lang, "yesnoButtons") }];
    s.responses.push(a);
    s.q += 1;

    if (s.q < QUESTION_TRAITS.length) return [{ type: "yesno", text: questionText(s.q, lang), buttons: i18n.t(lang, "yesnoButtons") }];

    // Finished — compute matches, mint a report token, present results
    computeMatches(s);
    if (!s.report_token) s.report_token = crypto.randomBytes(10).toString("hex");
    s.step = "exploring";
    return [
      { type: "text", text: i18n.t(lang, "completionIntro", s.data.name, QUESTION_TRAITS.length) + gradeTip(s.data.grade, lang) + "\n\n" + i18n.t(lang, "resultsIntro") },
      { type: "text", text: resultsListText(s) },
      reportPiece(s),
      { type: "text", text: i18n.t(lang, "exploreMatchesHeader") + menuText(s) },
    ];
  }

  if (s.step === "results" || s.step === "exploring") {
    const ids = s.data.matches || [];
    const n = parseInt(input, 10);
    if (n >= 1 && n <= ids.length) {
      s.step = "exploring";
      const c = careerById(ids[n - 1]);
      const sponsor = await findSponsorMatch(s.data.city, c.traits);
      let detail = careerDetailText(s, c);
      if (sponsor) {
        detail +=
          `${i18n.t(lang, "sponsoredNear")}\n*${sponsor.college.name}* — ${sponsor.course.name}` +
          (sponsor.college.website ? `\n${sponsor.college.website}` : "");
      }
      return [
        { type: "text", text: detail },
        { type: "text", text: menuText(s) },
      ];
    }
    return [
      { type: "text", text: i18n.t(lang, "invalidExplore") },
      { type: "text", text: resultsListText(s) },
    ];
  }

  return [{ type: "text", text: i18n.t(lang, "fallbackRestart") }];
}

// Matches a language-selection reply against lib/i18n.js's LANGUAGES —
// accepts either the language id directly (Meta list/button reply, e.g.
// "zu") or a 1-based number matching the list position (Twilio's plain-text
// numbered fallback, since it has no registered List Picker template for
// this).
function pickLanguage(input) {
  const v = (input || "").trim().toLowerCase();
  const byId = i18n.LANGUAGES.find((l) => l.id === v);
  if (byId) return byId.id;
  const n = parseInt(v, 10);
  if (n >= 1 && n <= i18n.LANGUAGES.length) return i18n.LANGUAGES[n - 1].id;
  return null;
}

// First real message after language selection: welcome + consent gate
// (POPIA). Learner must agree before we collect any personal information.
function welcomePiece(s) {
  const lang = langOf(s);
  return {
    type: "consent",
    text: i18n.t(lang, "welcome").replace("{privacyUrl}", PRIVACY_URL),
    buttons: i18n.t(lang, "consentButtons"),
  };
}

// Sends the personalised PDF career report as a WhatsApp document.
function reportPiece(s) {
  const lang = langOf(s);
  return {
    type: "media",
    mediaUrl: `${REPORT_BASE}/report?t=${s.report_token}`,
    text: i18n.t(lang, "reportCaption", s.data.name),
  };
}

// ===================== Supabase persistence (REST) =====================
function supabaseRequest(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    };
    if (method === "POST") headers["Prefer"] = "resolution=merge-duplicates,return=minimal";
    if (method === "PATCH") headers["Prefer"] = "return=representation";
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
    const req = https.request({ hostname: url.hostname, path: `/rest/v1/${path}`, method, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ ok: res.statusCode < 300, status: res.statusCode, json: data ? JSON.parse(data) : null }); }
        catch { resolve({ ok: res.statusCode < 300, status: res.statusCode, json: null }); }
      });
    });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

async function loadSession(phone) {
  if (!hasSupabase()) return memory[phone] || null;
  const r = await supabaseRequest("GET", `whatsapp_sessions?phone=eq.${encodeURIComponent(phone)}&limit=1`);
  if (r.ok && Array.isArray(r.json) && r.json.length) {
    const row = r.json[0];
    return { phone, step: row.step, data: row.data || {}, q: row.q || 0, responses: row.responses || [], report_token: row.report_token || null, version: row.version || 1 };
  }
  return null;
}

// Saves the session. For a session that was freshly created this turn (no
// version yet) this is a plain insert. For a session loaded from the DB,
// this does an optimistic-concurrency update guarded on the version we
// loaded — if another request for the same phone (e.g. a webhook retry
// racing the original) already saved a newer version, this update matches
// zero rows and we report the loss so the caller can avoid sending a
// duplicate reply. Returns true if this save "won".
async function saveSession(s, { isNew } = {}) {
  if (!hasSupabase()) { memory[s.phone] = s; return true; }
  const fields = { phone: s.phone, step: s.step, data: s.data, q: s.q, responses: s.responses, report_token: s.report_token || null, updated_at: new Date().toISOString() };

  if (isNew) {
    const r = await supabaseRequest("POST", "whatsapp_sessions", { ...fields, version: 1 });
    return r.ok;
  }

  const prevVersion = s.version || 1;
  s.version = prevVersion + 1;
  const r = await supabaseRequest(
    "PATCH",
    `whatsapp_sessions?phone=eq.${encodeURIComponent(s.phone)}&version=eq.${prevVersion}&select=phone`,
    { ...fields, version: s.version }
  );
  return r.ok && Array.isArray(r.json) && r.json.length > 0;
}

// Finds the best-matching active sponsor course for a career's traits,
// scoped to the learner's city (or shown nationally when a college has no
// city set). Scored the same way computeMatches ranks careers.
async function findSponsorMatch(city, careerTraits) {
  if (!hasSupabase()) return null;
  const cityFilter = city ? `,city.eq.${encodeURIComponent(city)}` : "";
  const r = await supabaseRequest(
    "GET",
    `colleges?select=*,courses(*)&active=eq.true&or=(city.is.null,city.eq.Other${cityFilter})`
  );
  if (!r.ok || !Array.isArray(r.json)) return null;

  const [primary, secondary] = careerTraits;
  let best = null;
  for (const college of r.json) {
    for (const course of college.courses || []) {
      if (!course.active) continue;
      const m = course.riasec_match || {};
      const score = (m[primary] || 0) * 2 + (secondary ? m[secondary] || 0 : 0);
      if (score > 0 && (!best || score > best.score)) best = { score, college, course };
    }
  }
  return best;
}

async function deleteSession(phone) {
  if (!hasSupabase()) { delete memory[phone]; return; }
  await supabaseRequest("DELETE", `whatsapp_sessions?phone=eq.${encodeURIComponent(phone)}`);
}

module.exports = {
  QUESTION_TRAITS,
  questionText,
  computeMatches,
  gradeTip,
  resultsListText,
  menuText,
  careerDetailText,
  advance,
  welcomePiece,
  reportPiece,
  loadSession,
  saveSession,
  deleteSession,
  findSponsorMatch,
  rateLimited,
  hasSupabase,
  langOf,
};
