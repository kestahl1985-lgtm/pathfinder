// Vula RIASEC assessment: questions, scoring, career/sponsor matching, and
// session persistence. Shared by every messaging provider (Twilio, Meta
// Cloud API, ...) — nothing in this file talks to a specific provider's
// send/receive API. A provider's webhook handler is expected to:
//   1. parse the inbound message into (phone, input, rawBody)
//   2. call loadSession / advance / saveSession
//   3. render the returned "pieces" (type: text|yesno|consent|media|language)
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
const { PROVINCES, normalizeProvince } = require("./provinces.js");
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
  // A full onboarding + 30-question assessment is already ~39 messages on
  // its own (9 onboarding steps + 30 answers), before any retry (mistyped
  // age, invalid grade) or exploring a matched career. A learner tapping
  // through quickly on WhatsApp buttons can legitimately hit that in under a
  // minute, so the cap needs real headroom above the happy path — this is
  // abuse defence, not a legitimate-usage throttle.
  const MAX = 100; // messages per minute per sender
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

// ===================== RIASEC matching =====================
// See docs/RIASEC_MATCHING_SPEC.md for the theory and the verified indices.
//
// The Holland types sit in a fixed hexagon R-I-A-S-E-C; distance around it
// encodes similarity (adjacent ≈ related, opposite ≈ unrelated). This single
// function underlies all matching.
const HEX = "RIASEC";
function hexDist(a, b) {
  const d = Math.abs(HEX.indexOf(a) - HEX.indexOf(b));
  return Math.min(d, 6 - d); // cyclic: 0 same, 1 adjacent, 2 alternate, 3 opposite
}

// Synthesize a career's ideal six-dimension interest profile from its 1–3
// letter high-point code, spreading each code letter across the hexagon (full
// at the letter, less to neighbours, none opposite). Position weights 3/2/1
// follow Brown-C, so the dominant letter leads.
function idealProfile(code) {
  const posW = [3, 2, 1];
  const ideal = {};
  for (const t of HEX) {
    let v = 0;
    for (let i = 0; i < code.length && i < 3; i++) v += posW[i] * (3 - hexDist(t, code[i]));
    ideal[t] = v;
  }
  return ideal;
}

// INTERIM matching — not the 3-letter Brown & Gore C index the spec recommends
// (that needs counsellor-assigned third letters the approved codes don't have
// yet). Congruence = cosine similarity between the person's FULL six scores and
// the career's synthesized ideal profile. This is the profile-correlation
// family Xu & Li (2020) rate highest, with the career profile derived from its
// high-point code. It is:
//   • length-normalized — a 2-letter career can't outscore a better-fitting
//     1-letter one just by accumulating more weight (the bug the old
//     primary×2+secondary and a naive weighted sum both had);
//   • shape-aware — a person strong on two types fits a career needing both
//     better than one needing only one;
//   • hexagon-aware — an adjacent near-miss scores high, an opposite scores ~0.
// Swap the synthesized ideal for real six-score career profiles later (e.g.
// O*NET) and the method is unchanged. `profile` is any {R,I,A,S,E,C} object
// (a person's scores, or a sponsor course's riasec_match); `code` is the
// career's high-point code (array or string).
function affinity(profile, code) {
  const arr = Array.isArray(code) ? code : String(code || "").split("");
  if (!arr.length) return 0;
  const ideal = idealProfile(arr);
  let dot = 0, pn = 0, inorm = 0;
  for (const t of HEX) {
    const p = profile[t] || 0, id = ideal[t];
    dot += p * id; pn += p * p; inorm += id * id;
  }
  if (pn === 0 || inorm === 0) return 0;
  return dot / (Math.sqrt(pn) * Math.sqrt(inorm)); // 0..1
}

// The person's six letters, highest score first. Used for the RESULT MESSAGE
// (top strengths, differentiation, consistency) — matching itself uses the
// full profile via affinity(), so it never depends on this ordering and the
// Rule of 8 tie problem cannot distort a ranking.
function personCode(scores) {
  return HEX.split("").sort((a, b) => scores[b] - scores[a]);
}

// Differentiation: how peaked the profile is (0–10 on Vula's scale). A flat
// profile means the code barely means anything, and results should be framed
// as broad/exploratory rather than a verdict.
function differentiation(scores) {
  const v = HEX.split("").map((t) => scores[t]);
  return Math.max(...v) - Math.min(...v);
}

// Consistency: are the top two interests compatible on the hexagon?
// adjacent = high, alternate = medium, opposite = low (conflicting interests).
function consistency(scores) {
  const [a, b] = personCode(scores);
  const d = hexDist(a, b);
  return d === 1 ? "high" : d === 2 ? "medium" : "low";
}

// Compute trait scores, top traits, profile shape, and the top-6 matched careers.
function computeMatches(s) {
  const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  s.responses.forEach((a, i) => { scores[QUESTION_TRAITS[i]] += a; });
  s.data.scores = scores;
  s.data.top = personCode(scores).slice(0, 3);
  s.data.differentiation = differentiation(scores);
  s.data.consistency = consistency(scores);

  const ranked = CAREERS.map((c) => ({
    id: c.id,
    score: affinity(scores, c.traits),
  })).sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id))); // stable tie-break
  s.data.matches = ranked.slice(0, 6).map((r) => r.id);
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

// Visual meter so the AI-impact rating is scannable at a glance, not just a
// bare word — "Medium"/"High" read as alarming without it.
const AI_IMPACT_BARS = { Low: "🟩⬜⬜", Medium: "🟨🟨⬜", High: "🟥🟥🟥" };

function careerDetailText(s, c) {
  const lang = langOf(s);
  const traitNames = i18n.TRAIT_NAMES[lang] || i18n.TRAIT_NAMES[i18n.DEFAULT_LANG];
  const tops = (s.data.top || []).slice(0, 2).map((x) => traitNames[x]);
  const strengths = tops.length ? `${tops.length > 1 ? `*${tops.join("* / *")}*` : `*${tops[0]}*`} — ` : "";
  const aiImpact = c.aiImpact
    ? `\n\n${i18n.t(lang, "careerAiImpact")} ${AI_IMPACT_BARS[c.aiImpact] || ""} ${c.aiImpact}\n_${c.aiImpactNote}_`
    : "";
  return (
    `🎯 *${c.name}*\n\n` +
    `${i18n.t(lang, "careerWhy")} ${strengths}${c.why}\n\n` +
    `${i18n.t(lang, "careerSubjects")} ${c.subjects}\n\n` +
    `${i18n.t(lang, "careerQual")} ${c.qual}` +
    aiImpact
  );
}

// ===================== State machine =====================
// FLOW_VERSION is stamped onto every new session and exists so a future
// flow change can detect sessions created under an older shape and decide
// what to do with them deliberately, instead of resuming them blind.
// History: v1 asked grade + suburb; v2 (July 2026) removed grade and asked
// province instead of suburb; v3 (July 2026) removed the school question.
// Bump this whenever the sequence of steps or questions changes.
const FLOW_VERSION = 3;

// Every step the current state machine knows how to handle. A stored
// session pointing at any other step (e.g. "grade"/"suburb"/"school" from
// an earlier flow version, or a corrupted value) must NOT be resumed —
// before this guard existed, such sessions fell through to a dead-end
// "reply RESTART" fallback, and an old session mid-assessment could surface
// a question number out of nowhere.
const VALID_STEPS = new Set([
  "language", "consent", "name", "surname", "age", "province",
  "assessment", "results", "exploring",
]);

// Gracefully restart a session whose stored state predates the current
// flow. Keeps the learner's language choice so the apology/restart reads in
// their language; clears everything else including consent (they must
// re-consent since data collection starts over) and the report token (the
// report renders from data that is being cleared).
function resetOutdatedSession(s) {
  const lang = s.data && s.data.lang;
  s.data = lang ? { lang } : {};
  s.data.flow_version = FLOW_VERSION;
  s.q = 0;
  s.responses = [];
  s.report_token = null;
  const notice = { type: "text", text: i18n.t(lang || i18n.DEFAULT_LANG, "flowUpdatedNotice") };
  if (!lang) {
    s.step = "language";
    return [notice, { type: "language" }];
  }
  s.step = "consent";
  return [notice, welcomePiece(s)];
}

async function advance(s, input, rawBody) {
  if (!VALID_STEPS.has(s.step)) return resetOutdatedSession(s);

  if (s.step === "language") {
    const choice = pickLanguage(input);
    if (!choice) return [{ type: "language", retry: true }];
    s.data.lang = choice;
    s.data.flow_version = FLOW_VERSION;
    s.step = "consent";
    return [welcomePiece(s)];
  }

  const lang = langOf(s);

  if (s.step === "consent") {
    const v = (input || "").trim().toLowerCase();
    // "info" is accepted here because the approved `welcome_optin` WhatsApp
    // template tells people to reply INFO to see how their data is protected
    // (see WHATSAPP_PRODUCTION.md). Without this it fell through to the retry
    // message and the template's promise was simply broken. INFO means
    // something different once results exist — entry requirements for the
    // sponsor course last shown — which is fine: it is read in context.
    if (v === "more" || v === "info" || v === "more info") {
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
    s.step = "surname";
    return [{ type: "text", text: i18n.t(lang, "thankName", rawBody) }];
  }
  if (s.step === "surname") {
    s.data.surname = rawBody.slice(0, 40);
    s.step = "age";
    return [{ type: "text", text: i18n.t(lang, "thankSurname", rawBody) }];
  }
  if (s.step === "age") {
    const age = parseInt(input, 10);
    // Vula is for anyone seeking career direction, not only school learners —
    // there is deliberately no upper age limit. The floor of 12 is a child-
    // protection line rather than an audience one (POPIA treats under-18s as
    // needing a competent person's consent; below 12 a career assessment has
    // little value and collecting the data carries risk without benefit).
    // The ceiling of 100 is input sanity only: it catches someone typing a
    // birth year ("1985") instead of an age, which would otherwise be accepted.
    if (isNaN(age) || age < 12 || age > 100) return [{ type: "text", text: `${i18n.t(lang, "invalidAge")}\n\n${i18n.t(lang, "askAgeQuestion")}` }];
    s.data.age = age;
    s.step = "province";
    return [provincePiece(lang)];
  }
  if (s.step === "province") {
    const province = pickProvince(input, rawBody);
    if (!province) return [provincePiece(lang, true)];
    s.data.province = province;
    s.step = "assessment";
    // Explicitly zero BOTH the counter and the recorded answers: the
    // assessment branch derives its position from responses.length, so any
    // leftover answers from an abnormal prior state would otherwise start
    // the learner mid-assessment instead of at question 1.
    s.q = 0;
    s.responses = [];
    // Sent as ONE piece, not two — a prior version sent the intro and
    // question 1 as separate messages and relied on send order to keep them
    // in sequence, but that's not a guarantee WhatsApp's delivery actually
    // honours even when our own API calls go out sequentially (reported
    // twice: question 1 arriving before the intro). Merging them removes
    // the ordering question entirely rather than trying to win a race.
    return [
      { type: "yesno", text: `${i18n.t(lang, "assessmentIntro", s.data.name)}\n\n${questionText(0, lang)}`, buttons: i18n.t(lang, "yesnoButtons") },
    ];
  }

  if (s.step === "assessment") {
    // SEQUENCE INVARIANT: the question shown is always derived from how many
    // answers are actually recorded — never from the stored counter alone.
    // The stored `q` is just a cache; if it ever drifts from reality (a
    // stale session resumed after a code change, a partial write, manual DB
    // edits), deriving here self-heals instead of surfacing a question out
    // of sequence. Combined with QUESTION_TRAITS being a fixed array, this
    // makes skipping or reordering structurally impossible: position N is
    // reachable only by having exactly N recorded answers.
    s.responses = Array.isArray(s.responses) ? s.responses : [];
    s.q = s.responses.length;

    if (s.q < QUESTION_TRAITS.length) {
      let a = parseInt(input, 10);
      // A button tap always sends back its numeric id ("0"/"1"/"2"), but if
      // the interactive buttons ever fail to render (older client, delivery
      // hiccup) a learner can only type — and typing the exact word shown on
      // the button ("Yes"/"No"/"Maybe") is the natural thing to try. Without
      // this fallback that always fails as "invalid" with no way out.
      if (isNaN(a)) {
        const labels = i18n.t(lang, "yesnoButtons");
        const idx = labels.findIndex((l) => l.toLowerCase() === input.trim().toLowerCase());
        if (idx !== -1) a = idx;
      }
      if (![0, 1, 2].includes(a)) return [{ type: "yesno", text: i18n.t(lang, "invalidAssessmentAnswer") + questionText(s.q, lang), buttons: i18n.t(lang, "yesnoButtons") }];
      s.responses.push(a);
      s.q += 1;
    }

    if (s.q < QUESTION_TRAITS.length) return [{ type: "yesno", text: questionText(s.q, lang), buttons: i18n.t(lang, "yesnoButtons") }];

    // Finished — compute matches, mint a report token, present results.
    // Also reachable directly when a session arrives here with all answers
    // already recorded (e.g. a crash after the 30th answer was saved but
    // before results were sent) — finalize instead of overrunning the array.
    computeMatches(s);
    if (!s.report_token) {
      s.report_token = crypto.randomBytes(10).toString("hex");
      // Stable completion timestamp, set exactly once — used by api/reengage.js
      // to time grade-progression nudges. consent_at is from onboarding start,
      // not this moment, and the session's own updated_at drifts forward every
      // time the learner explores another career, so neither works for this.
      s.data.report_completed_at = new Date().toISOString();
    }
    s.step = "exploring";
    return [
      { type: "text", text: i18n.t(lang, "completionIntro", s.data.name, QUESTION_TRAITS.length) + i18n.t(lang, "resultsIntro") },
      { type: "text", text: resultsListText(s) },
      reportPiece(s),
      { type: "text", text: i18n.t(lang, "exploreMatchesHeader") + menuText(s) },
    ];
  }

  if (s.step === "results" || s.step === "exploring") {
    const ids = s.data.matches || [];

    // INFO — entrance requirements for the sponsor course last shown, answered
    // inside WhatsApp rather than by sending the learner to a web page. Data
    // is the single largest barrier for this audience (R79/GB), so every step
    // that would push them out to a heavy site is a step where they drop.
    if (/^info$/i.test(String(input || "").trim())) {
      const last = s.data.last_sponsor;
      if (!last) return [{ type: "text", text: i18n.t(lang, "infoNothingToShow") + menuText(s) }];
      const pieces = [{ type: "text", text: sponsorInfoText(lang, last) }];
      if (last.prospectus_url) {
        pieces.push(prospectusPiece(lang, { college: { name: last.college_name }, course: { name: last.course_name, prospectus_url: last.prospectus_url } }));
      }
      pieces.push({ type: "text", text: menuText(s) });
      return pieces;
    }

    const n = parseInt(input, 10);
    if (n >= 1 && n <= ids.length) {
      s.step = "exploring";
      const c = careerById(ids[n - 1]);
      const sponsor = await findSponsorMatch(s.data.province, c.traits);
      let detail = careerDetailText(s, c);
      if (sponsor) {
        detail +=
          `${i18n.t(lang, "sponsoredNear")}\n*${sponsor.college.name}* — ${sponsor.course.name}` +
          (sponsor.college.website ? `\n${sponsor.college.website}` : "") +
          i18n.t(lang, "sponsorInfoPrompt");
        // Remember enough to answer INFO without a second lookup, and so the
        // answer always describes the course the learner actually just saw.
        s.data.last_sponsor = {
          college_name: sponsor.college.name,
          course_name: sponsor.course.name,
          required_subjects: sponsor.course.required_subjects || null,
          duration_years: sponsor.course.duration_years || null,
          description: sponsor.course.description || null,
          website: sponsor.college.website || null,
          contact_email: sponsor.college.contact_email || null,
          prospectus_url: sponsor.course.prospectus_url || null,
        };
        await logSponsorMatch(s, sponsor, c.id);
      }
      const pieces = [{ type: "text", text: detail }];
      // Only add a second message when there's an actual document to send —
      // most sponsors won't have one uploaded, and a website link alone
      // already lives in `detail` above.
      if (sponsor && sponsor.course.prospectus_url) {
        pieces.push(prospectusPiece(lang, sponsor));
      }
      pieces.push({ type: "text", text: menuText(s) });
      return pieces;
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
// Resolves a province from either a tapped list row (whose id IS the canonical
// province name), a 1-based number (the Twilio plain-text fallback), or typed
// free text.
//
// Returns null when nothing matches, so the caller can re-prompt. That's the
// important part: normalizeProvince() alone answers "Other" for anything it
// doesn't recognise, which silently filed learners under the wrong province —
// e.g. "western province" resolved to Northern Cape, and those learners then
// matched no sponsor at all. An unrecognised answer must ask again, not guess.
// "Other" is still accepted when it's an explicit choice from the list.
function pickProvince(input, rawBody) {
  const v = String(input || "").trim();
  const exact = PROVINCES.find((p) => p.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  const n = parseInt(v, 10);
  if (n >= 1 && n <= PROVINCES.length) return PROVINCES[n - 1];
  const normalized = normalizeProvince(rawBody);
  if (normalized && normalized !== "Other") return normalized;
  return null;
}

// The province prompt as a tappable list — Meta renders it as a native List
// Message, Twilio falls back to numbered text. Carries its own localized copy
// and rows so each provider's send code stays dumb about content.
function provincePiece(lang, retry) {
  return {
    type: "province",
    text: i18n.t(lang, retry ? "askProvinceRetry" : "askProvince"),
    button: i18n.t(lang, "provinceListButton"),
    rows: PROVINCES,
  };
}

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

// A display filename shown in the WhatsApp document bubble — sanitized
// since it's built from admin-entered sponsor/course names, not a fixed
// string like the report's.
function safeFilename(name) {
  return name.replace(/[^\w\s-]/g, "").trim().slice(0, 80) || "Prospectus";
}

// Builds the INFO reply for the sponsor course a learner last saw. Everything
// here comes from the sponsor's own Schedule A course record, so the answer is
// theirs, not Vula's — and it stays inside WhatsApp rather than sending a
// data-conscious learner out to a web page.
function sponsorInfoText(lang, last) {
  let t = i18n.t(lang, "infoHeader", last.college_name, last.course_name);
  if (Array.isArray(last.required_subjects) && last.required_subjects.length) {
    t += `\n\n${i18n.t(lang, "infoSubjects")}\n• ${last.required_subjects.join("\n• ")}`;
  }
  if (last.duration_years) t += `\n\n${i18n.t(lang, "infoDuration", last.duration_years)}`;
  if (last.description) t += `\n\n${last.description}`;
  if (last.website) t += `\n\n${i18n.t(lang, "infoApply")}\n${last.website}`;
  if (last.contact_email) t += `\n${last.contact_email}`;
  return t;
}

// Sends a sponsor's uploaded course prospectus as a WhatsApp document —
// only called when sponsor.course.prospectus_url is set (see advance()).
function prospectusPiece(lang, sponsor) {
  return {
    type: "media",
    mediaUrl: sponsor.course.prospectus_url,
    text: i18n.t(lang, "prospectusCaption", sponsor.college.name),
    filename: `${safeFilename(sponsor.college.name)} - ${safeFilename(sponsor.course.name)}.pdf`,
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
// scoped to the learner's province (or shown nationally when a college has
// no province set). Scored the same way computeMatches ranks careers.
//
// Was city-scoped until the onboarding flow dropped the suburb question
// (which is what "city" was ever derived from) — switched to province,
// the only geographic signal now collected. Safe to do without a data
// migration since no real sponsor colleges had been onboarded yet; the
// `colleges.city` column is left in place (unused going forward) rather
// than dropped, since dropping it isn't necessary and avoids churn.
// Candidates scoring within this fraction of the best score stay in contention
// for rotation. Set deliberately: two institutions tagging the same course
// slightly differently (R:5,I:4 vs R:4,I:5) score 14 vs 13 for an [R,I] career
// — a 7% gap that, under strict "highest wins", handed the first one 100% of
// impressions forever. The band keeps genuinely comparable sponsors in play
// while still excluding weak matches, so relevance is never traded for fairness.
const ROTATION_BAND = 0.85;

// Rotation balances *recent* delivery, not all-time. A sponsor who joins in
// month six should not have to wait out a year of someone else's history
// before being shown.
const ROTATION_WINDOW_DAYS = 30;

// Chooses between scored sponsor candidates. Pure and synchronous so the
// deploy-gate test can exercise the fairness rules without a database.
//
// Order of precedence:
//   1. relevance  — only candidates within ROTATION_BAND of the best score
//   2. fairness   — fewest impressions delivered in the window goes first
//   3. quality    — better match wins among equally-served candidates
//   4. stability  — course id, so the outcome never depends on row order
//
// `counts` maps course id -> impressions already delivered. A missing entry
// counts as zero, so a failed count lookup degrades to score-then-id ordering
// rather than breaking the placement.
function selectSponsor(candidates, counts) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const best = candidates.reduce((m, c) => (c.score > m ? c.score : m), 0);
  if (best <= 0) return null;

  const threshold = best * ROTATION_BAND;
  const contenders = candidates.filter((c) => c.score >= threshold);

  const served = (c) => (counts && counts[c.course.id]) || 0;
  contenders.sort(
    (a, b) =>
      served(a) - served(b) ||
      b.score - a.score ||
      String(a.course.id).localeCompare(String(b.course.id))
  );
  return contenders[0];
}

// Impressions delivered per course inside the rotation window. Only the
// contending course ids are queried, so the row set stays small even once
// the match log is large.
async function recentImpressionCounts(courseIds) {
  const counts = {};
  if (!courseIds.length) return counts;
  const since = new Date(Date.now() - ROTATION_WINDOW_DAYS * 86400000).toISOString();
  const list = courseIds.map(encodeURIComponent).join(",");
  const r = await supabaseRequest(
    "GET",
    `sponsor_matches?select=course_id&course_id=in.(${list})&created_at=gte.${since}`
  );
  if (!r.ok || !Array.isArray(r.json)) return counts; // degrade to score ordering
  for (const row of r.json) counts[row.course_id] = (counts[row.course_id] || 0) + 1;
  return counts;
}

async function findSponsorMatch(province, careerTraits) {
  if (!hasSupabase()) return null;
  const provinceFilter = province ? `,province.eq.${encodeURIComponent(province)}` : "";
  const r = await supabaseRequest(
    "GET",
    // Explicit order: without it PostgREST's row order is undefined, which
    // previously made tie-breaks depend on insertion accident.
    `colleges?select=*,courses(*)&active=eq.true&or=(province.is.null,province.eq.Other${provinceFilter})&order=id`
  );
  if (!r.ok || !Array.isArray(r.json)) return null;

  // Same hexagon-aware affinity() the learner side uses, so a sponsor course's
  // relevance to a career is scored on one scale with everything else: the
  // course's riasec_match profile against the career's high-point code.
  const candidates = [];
  for (const college of r.json) {
    for (const course of college.courses || []) {
      if (!course.active) continue;
      const score = affinity(course.riasec_match || {}, careerTraits);
      if (score > 0) candidates.push({ score, college, course });
    }
  }
  if (candidates.length === 0) return null;
  // Single candidate is the common case — skip the count query entirely.
  if (candidates.length === 1) return candidates[0];

  const best = candidates.reduce((m, c) => (c.score > m ? c.score : m), 0);
  const contending = candidates.filter((c) => c.score >= best * ROTATION_BAND);
  const counts = contending.length > 1
    ? await recentImpressionCounts(contending.map((c) => c.course.id))
    : {};
  return selectSponsor(candidates, counts);
}

// Logs a sponsor-match impression: which college/course was shown to this
// learner, alongside a snapshot of their assessment outcome at that moment
// (RIASEC scores, top traits, age/province). Lets admin later analyse which
// institutions/courses match which kinds of learners. grade/city/suburb are
// no longer collected during onboarding (see advance()'s "age"/"province"
// steps) so those columns will be null going forward — left in the insert
// and the table schema for historical sessions that still have them.
// Awaited by the caller (Vercel kills unawaited work once the response is
// sent), but supabaseRequest never throws on failure — a logging outage
// can never break the learner's reply, only silently skip the log row.
async function logSponsorMatch(s, sponsor, careerId) {
  if (!hasSupabase()) return;
  await supabaseRequest("POST", "sponsor_matches", {
    phone: s.phone,
    college_id: sponsor.college.id,
    course_id: sponsor.course.id,
    career_id: careerId,
    match_score: sponsor.score,
    riasec_scores: s.data.scores || null,
    top_traits: s.data.top || null,
    grade: s.data.grade || null,
    age: s.data.age || null,
    province: s.data.province || null,
    city: s.data.city || null,
    suburb: s.data.suburb || null,
  });
}

// Deleting a session must also clear the learner's phone number out of
// every other table that keys off it (sponsor_matches, reengagement_queue)
// — otherwise a learner who replies DELETE (a right we explicitly promise
// them in the welcome/consent text) still has their number and RIASEC
// profile sitting in those tables indefinitely, which defeats the promise.
async function deleteSession(phone) {
  if (!hasSupabase()) { delete memory[phone]; return; }
  await Promise.all([
    supabaseRequest("DELETE", `whatsapp_sessions?phone=eq.${encodeURIComponent(phone)}`),
    supabaseRequest("DELETE", `sponsor_matches?phone=eq.${encodeURIComponent(phone)}`),
    supabaseRequest("DELETE", `reengagement_queue?phone=eq.${encodeURIComponent(phone)}`),
  ]);
}

module.exports = {
  QUESTION_TRAITS,
  questionText,
  computeMatches,
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
  selectSponsor,
  affinity,
  hexDist,
  personCode,
  differentiation,
  consistency,
  ROTATION_BAND,
  ROTATION_WINDOW_DAYS,
  rateLimited,
  hasSupabase,
  langOf,
};
