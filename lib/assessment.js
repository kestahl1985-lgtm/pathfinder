// Vula RIASEC assessment: questions, scoring, career/sponsor matching, and
// session persistence. Shared by every messaging provider (Twilio, Meta
// Cloud API, ...) — nothing in this file talks to a specific provider's
// send/receive API. A provider's webhook handler is expected to:
//   1. parse the inbound message into (phone, input, rawBody)
//   2. call loadSession / advance / saveSession
//   3. render the returned "pieces" (type: text|yesno|grade|consent|media)
//      using its own provider-specific message format

const https = require("https");
const crypto = require("crypto");

const { TRAIT_NAMES, CAREERS, careerById } = require("./careers.js");
const { normalizeCity } = require("./cities.js");

const PRIVACY_URL = process.env.PRIVACY_URL || "https://vulacareers.co.za/privacy.html";
const REPORT_BASE = process.env.PUBLIC_BASE_URL || "https://pathfinder-backend-one.vercel.app";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
const memory = {};

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
// 30 questions, 5 per trait, interleaved. { t: trait, q: text }
const QUESTIONS = [
  { t: "R", q: "Do you enjoy building, fixing or assembling things with your hands?" },
  { t: "I", q: "Do you enjoy solving puzzles or figuring out how things work?" },
  { t: "A", q: "Do you enjoy drawing, designing, writing or making music?" },
  { t: "S", q: "Do you enjoy helping people solve their problems?" },
  { t: "E", q: "Do you enjoy leading a team or being in charge?" },
  { t: "C", q: "Do you like keeping things organised and in order?" },

  { t: "R", q: "Would you like a job working with tools, machines or equipment?" },
  { t: "I", q: "Are you curious about science, nature or how the world works?" },
  { t: "A", q: "Do you like coming up with original ideas and being creative?" },
  { t: "S", q: "Would you like a job caring for, teaching or supporting others?" },
  { t: "E", q: "Would you like to start your own business one day?" },
  { t: "C", q: "Do you enjoy working with numbers, records or budgets?" },

  { t: "R", q: "Do you prefer being active and on your feet rather than at a desk?" },
  { t: "I", q: "Do you like researching a topic deeply until you understand it?" },
  { t: "A", q: "Would you enjoy a career in art, media, fashion or performance?" },
  { t: "S", q: "Do friends often come to you for advice or support?" },
  { t: "E", q: "Are you good at convincing or persuading people?" },
  { t: "C", q: "Do you prefer clear instructions and well-structured tasks?" },

  { t: "R", q: "Are you interested in how engines, electronics or structures work?" },
  { t: "I", q: "Would you enjoy analysing data or numbers to find answers?" },
  { t: "A", q: "Do you express yourself through style, art or storytelling?" },
  { t: "S", q: "Do you feel good when you make a difference in someone's life?" },
  { t: "E", q: "Do you enjoy competing and aiming to win?" },
  { t: "C", q: "Are you careful with details and accuracy?" },

  { t: "R", q: "Would you enjoy working outdoors or on a worksite?" },
  { t: "I", q: "Do you enjoy subjects like Maths, Physics or Life Sciences?" },
  { t: "A", q: "Do you prefer freedom and variety over strict routine?" },
  { t: "S", q: "Do you enjoy working closely with people rather than alone?" },
  { t: "E", q: "Would you enjoy selling, marketing or pitching ideas?" },
  { t: "C", q: "Would you enjoy office work like admin, finance or planning?" },
];

function questionText(i) {
  return `*Question ${i + 1} of ${QUESTIONS.length}*\n\n${QUESTIONS[i].q}`;
}

// Compute trait scores, top traits, and the top-6 matched careers.
function computeMatches(s) {
  const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  s.responses.forEach((a, i) => { scores[QUESTIONS[i].t] += a; });
  s.data.scores = scores;
  s.data.top = Object.keys(scores).sort((a, b) => scores[b] - scores[a]).slice(0, 3);

  const ranked = CAREERS.map((c) => ({
    id: c.id,
    score: scores[c.traits[0]] * 2 + (c.traits[1] ? scores[c.traits[1]] : 0),
  })).sort((a, b) => b.score - a.score);

  s.data.matches = ranked.slice(0, 6).map((r) => r.id);
}

function gradeTip(grade) {
  if (grade === 10) return "You're in Grade 10 — perfect timing to choose the right subjects. 🎯";
  if (grade === 11) return "You're in Grade 11 — there may still be time to adjust subjects. ⏳";
  return "You're in Grade 12 — focus on the marks and applications these paths need. 📨";
}

function resultsListText(s) {
  const ids = s.data.matches || [];
  let t =
    `🧭 *Your top strengths:* ${s.data.top.map((x) => TRAIT_NAMES[x]).join(", ")}\n\n` +
    `💼 *Careers that fit you:*\n\n`;
  ids.forEach((id, i) => {
    const c = careerById(id);
    t += `*${i + 1}.* *${c.name}*\n     ${c.list}\n`;
  });
  t += `\n👉 Reply with a *number (1–${ids.length})* to explore a career — why it fits you, the subjects you'll need, and how to qualify.`;
  return t;
}

function menuText(s) {
  const ids = s.data.matches || [];
  let t = "🔁 *Explore another career — reply a number:*\n";
  ids.forEach((id, i) => { t += `${i + 1}. ${careerById(id).name}\n`; });
  t += `\n_Reply RESTART to retake the assessment._`;
  return t;
}

function careerDetailText(s, c) {
  const tops = (s.data.top || []).slice(0, 2).map((x) => TRAIT_NAMES[x]);
  const strengths = tops.length ? `Your strengths in *${tops.join("* and *")}* point this way. ` : "";
  return (
    `🎯 *${c.name}*\n\n` +
    `✅ *Why it fits you:* ${strengths}${c.why}\n\n` +
    `📚 *Subjects you'll need:* ${c.subjects}\n\n` +
    `🎓 *How to qualify:* ${c.qual}`
  );
}

// ===================== State machine =====================
async function advance(s, input, rawBody) {
  if (s.step === "consent") {
    const v = (input || "").toLowerCase();
    if (v === "more") {
      return [{ type: "consent", text: MORE_INFO_TEXT }];
    }
    if (v === "agree" || v === "yes" || v === "i agree" || v.includes("agree")) {
      s.data.consent = true;
      s.data.consent_at = new Date().toISOString();
      s.step = "name";
      return [{ type: "text", text: "Thank you! 🙌\n\nLet's begin — what's your *first name*?" }];
    }
    return [{ type: "consent", text: "To use Vula we need your agreement to continue. Tap *I agree*, or *More info* to learn more. 👇" }];
  }

  if (s.step === "name") {
    s.data.name = rawBody.slice(0, 40);
    s.step = "school";
    return [{ type: "text", text: `Nice to meet you, ${rawBody}! 🎓\n\nWhich school do you attend?` }];
  }
  if (s.step === "school") {
    s.data.school = rawBody.slice(0, 60);
    s.step = "age";
    return [{ type: "text", text: `Got it — ${rawBody}. 🏫\n\nHow old are you? (e.g. 16)` }];
  }
  if (s.step === "age") {
    const age = parseInt(input, 10);
    if (isNaN(age) || age < 12 || age > 25) return [{ type: "text", text: "Please reply with a valid age between 12 and 25." }];
    s.data.age = age;
    s.step = "city";
    return [{ type: "text", text: "Thanks! 🎂\n\nWhich city or town are you closest to? (e.g. Cape Town, Johannesburg, Durban)" }];
  }
  if (s.step === "city") {
    s.data.city = normalizeCity(rawBody);
    s.step = "suburb";
    return [{ type: "text", text: "Got it! 📍\n\nAnd which suburb or area do you live in?" }];
  }
  if (s.step === "suburb") {
    s.data.suburb = rawBody.slice(0, 40);
    s.step = "grade";
    return [{ type: "grade", text: `${rawBody} — noted.\n\nWhat grade are you in?` }];
  }
  if (s.step === "grade") {
    const grade = parseInt(input, 10);
    if (![10, 11, 12].includes(grade)) return [{ type: "grade", text: "Please choose your grade below 👇" }];
    s.data.grade = grade;
    s.step = "assessment";
    s.q = 0;
    return [
      {
        type: "text",
        text:
          `✅ Thanks ${s.data.name}, your profile is set!\n\n` +
          `📋 *Now the assessment* — 30 quick questions about what you enjoy. ` +
          `There are no right or wrong answers, just tap what feels like *you*. ` +
          `It takes about 4 minutes and you can pause anytime. 💡`,
      },
      { type: "yesno", text: questionText(0) },
    ];
  }

  if (s.step === "assessment") {
    const a = parseInt(input, 10);
    if (![0, 1, 2].includes(a)) return [{ type: "yesno", text: "Please tap one of the options below 👇\n\n" + questionText(s.q) }];
    s.responses.push(a);
    s.q += 1;

    if (s.q < QUESTIONS.length) return [{ type: "yesno", text: questionText(s.q) }];

    // Finished — compute matches, mint a report token, present results
    computeMatches(s);
    if (!s.report_token) s.report_token = crypto.randomBytes(10).toString("hex");
    s.step = "exploring";
    return [
      {
        type: "text",
        text:
          `🎉 You did it, ${s.data.name}! You answered all ${QUESTIONS.length} questions.\n\n` +
          `${gradeTip(s.data.grade)}\n\nHere's what your profile reveals 👇`,
      },
      { type: "text", text: resultsListText(s) },
      reportPiece(s),
      { type: "text", text: "Now explore your matches 👇\n\n" + menuText(s) },
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
          `\n\n🏫 *Sponsored option near you:*\n*${sponsor.college.name}* — ${sponsor.course.name}` +
          (sponsor.college.website ? `\n${sponsor.college.website}` : "");
      }
      return [
        { type: "text", text: detail },
        { type: "text", text: menuText(s) },
      ];
    }
    return [
      { type: "text", text: "Please reply with a number from the list 👇" },
      { type: "text", text: resultsListText(s) },
    ];
  }

  return [{ type: "text", text: "Reply RESTART to begin again." }];
}

// First message: welcome + consent gate (POPIA). Learner must agree before
// we collect any personal information.
function welcomePiece() {
  return {
    type: "consent",
    text:
      "👋 Welcome to *Vula* — your free career guide on WhatsApp!\n\n" +
      "Before we start, a quick note on your privacy:\n" +
      "• We'll ask a few details (name, school, age, city, grade) to give you accurate guidance.\n" +
      "• Your info is kept private and used only to help you.\n" +
      "• We may show you sponsor college/bursary options that match your results — reaching out to them is always your choice.\n" +
      "• If you're under 18, please make sure a *parent or guardian* is happy for you to continue.\n\n" +
      `Read how we protect your info: ${PRIVACY_URL}\n\n` +
      "Tap *I agree* to begin. 👇",
  };
}

const MORE_INFO_TEXT =
  "🔒 *How Vula uses your info*\n\n" +
  "• We only collect what's needed to guide you: name, school, age, city, grade and your answers.\n" +
  "• We never ask for ID numbers, passwords or banking details.\n" +
  "• Vula is funded by sponsoring colleges — we may show you their courses if they match your results, but we *never* share your personal details with them. Reaching out is always your choice.\n" +
  "• You can reply *DELETE* at any time to remove your information.\n\n" +
  `Full policy: ${PRIVACY_URL}\n\n` +
  "Tap *I agree* to continue. 👇";

// Sends the personalised PDF career report as a WhatsApp document.
function reportPiece(s) {
  return {
    type: "media",
    mediaUrl: `${REPORT_BASE}/report?t=${s.report_token}`,
    text:
      `📄 *Here's your full Vula Career Report, ${s.data.name}!*\n\n` +
      "It lays out your strengths, your matched careers, the exact subjects you'll need and how to qualify. " +
      "Save it and share it with your parents or teacher. 🎓\n\n" +
      "_Reply REPORT anytime to get it again._",
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
  QUESTIONS,
  questionText,
  computeMatches,
  gradeTip,
  resultsListText,
  menuText,
  careerDetailText,
  advance,
  welcomePiece,
  MORE_INFO_TEXT,
  reportPiece,
  loadSession,
  saveSession,
  deleteSession,
  findSponsorMatch,
  rateLimited,
  hasSupabase,
};
