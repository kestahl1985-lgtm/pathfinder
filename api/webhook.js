// Vula WhatsApp webhook.
//
// Flow: onboarding → 30-question RIASEC assessment (tappable buttons) →
// matched career list with reasoning → tap a number to explore a career
// (why it fits, subjects, qualifications) → go back and explore others.
//
// Buttons via Twilio Content API; state persisted in Supabase
// (whatsapp_sessions). Degrades to plain-text TwiML / in-memory if either
// service is unconfigured, so it always responds.

const https = require("https");

// --- Twilio ---
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SID_YESNO = process.env.CONTENT_SID_YESNO || "HX94ea41518e35dd7bd5c666b8b2f968d6";
const SID_GRADE = process.env.CONTENT_SID_GRADE || "HX8c9397cd6d8cc5c9cac8c478e51768ab";
const SID_CONSENT = process.env.CONTENT_SID_CONSENT || "HX389c1fc2e0a23ff51e7145227d8b8287";
const SID_SHARE = process.env.CONTENT_SID_SHARE || "HX77d094aff572d25bd61676055a75e7ef";

// Public URL of the privacy policy (update when the site is on its own domain)
const PRIVACY_URL = process.env.PRIVACY_URL || "https://vula.co.za/privacy.html";

// --- Supabase ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasTwilio = () => Boolean(ACCOUNT_SID && AUTH_TOKEN && PHONE_NUMBER);
const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
const memory = {};

// ===================== Assessment =====================
const TRAIT_NAMES = {
  R: "Hands-on & practical",
  I: "Curious & analytical",
  A: "Creative & expressive",
  S: "Caring & people-focused",
  E: "Driven & enterprising",
  C: "Organised & detail-focused",
};

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

// ===================== Careers (curated, SA-accurate) =====================
// traits[0] = primary, traits[1] = secondary (optional)
const CAREERS = [
  // Realistic
  { id: "engineer", name: "Engineer (Civil/Mechanical/Electrical)", traits: ["R", "I"], list: "Design and build the physical world",
    why: "Engineering blends hands-on problem-solving with strong maths and science — a great fit for practical, analytical minds.",
    subjects: "Mathematics + Physical Sciences (NOT Maths Literacy).",
    qual: "A 4-year BEng/BSc(Eng) at university, or a National Diploma in Engineering at a TVET college / University of Technology. Strong Maths & Science marks are essential." },
  { id: "electrician", name: "Electrician", traits: ["R"], list: "Install and repair electrical systems",
    why: "It's hands-on, technical work that's in high demand and pays well — ideal if you like fixing things and seeing real results.",
    subjects: "Mathematics (or Technical Maths); Physical Sciences helps.",
    qual: "TVET college electrical courses (N1–N6) plus a learnership/apprenticeship, then a Trade Test to qualify as an artisan." },
  { id: "mechanic", name: "Motor Mechanic", traits: ["R"], list: "Diagnose and repair vehicles",
    why: "If you like working with your hands and understanding how machines work, this is a practical, always-in-demand trade.",
    subjects: "Mathematics / Technical Maths; Physical Sciences helpful.",
    qual: "TVET Motor Mechanics programme + apprenticeship + Trade Test." },

  // Investigative
  { id: "doctor", name: "Doctor (Medicine)", traits: ["I", "S"], list: "Diagnose and treat patients",
    why: "Medicine suits curious, caring people who love science and want to help others directly.",
    subjects: "Mathematics + Physical Sciences + Life Sciences (high marks needed).",
    qual: "A 6-year MBChB degree at university. Very competitive — aim for excellent marks across Maths and Sciences." },
  { id: "datasci", name: "Data Scientist / IT Specialist", traits: ["I", "C"], list: "Find answers in data & build tech",
    why: "Strong analytical thinkers who enjoy maths and problem-solving thrive in data, software and tech roles.",
    subjects: "Mathematics is essential (NOT Maths Literacy).",
    qual: "A BSc in Computer Science / Data Science, or a National Diploma in IT at a University of Technology." },
  { id: "scientist", name: "Scientist / Researcher", traits: ["I"], list: "Investigate how the world works",
    why: "If you love understanding why and how things happen, research lets you explore science deeply.",
    subjects: "Mathematics + Physical Sciences and/or Life Sciences.",
    qual: "A BSc degree, usually followed by Honours and Masters for research roles." },

  // Artistic
  { id: "designer", name: "Graphic / UX Designer", traits: ["A"], list: "Create visuals, brands and apps",
    why: "Creative, expressive people who like making things look good and work well are a natural fit for design.",
    subjects: "No strict requirements; Visual Arts or Design helps. Good marks in any subjects.",
    qual: "A Diploma or Degree in Graphic / Visual / UX Design at a university, UoT or design college. A strong portfolio matters most." },
  { id: "architect", name: "Architect", traits: ["A", "R"], list: "Design buildings and spaces",
    why: "Architecture combines creativity with structure and maths — perfect for imaginative but practical thinkers.",
    subjects: "Mathematics + Physical Sciences, plus creative/visual aptitude.",
    qual: "A BAS (Architectural Studies) degree → Honours → Master of Architecture, or an Architectural Technology diploma." },
  { id: "media", name: "Journalist / Media & Content", traits: ["A", "S"], list: "Tell stories across media",
    why: "If you love writing, ideas and communicating, media and content creation let you express and inform.",
    subjects: "Strong Languages; good marks in any subjects.",
    qual: "A Diploma or Degree in Journalism, Media Studies or Communications." },

  // Social
  { id: "teacher", name: "Teacher", traits: ["S"], list: "Educate and shape young minds",
    why: "Patient, caring people who enjoy explaining things and helping others grow make great teachers.",
    subjects: "Languages plus the subjects you'd like to teach.",
    qual: "A 4-year BEd degree, or a Bachelor's degree followed by a PGCE. Funza Lushaka bursaries are often available." },
  { id: "nurse", name: "Nurse", traits: ["S", "I"], list: "Care for patients' health",
    why: "Nursing fits caring people who also enjoy health science and want hands-on impact.",
    subjects: "Life Sciences + Mathematics or Maths Literacy (varies by institution).",
    qual: "A 4-year Bachelor of Nursing, or a nursing diploma at an accredited college." },
  { id: "socialworker", name: "Social Worker", traits: ["S"], list: "Support people and communities",
    why: "If you want to make a real difference in people's lives, social work is deeply people-centred.",
    subjects: "Life Sciences or History helpful; good Languages.",
    qual: "A 4-year Bachelor of Social Work (BSW). Government bursaries are often available." },

  // Enterprising
  { id: "entrepreneur", name: "Entrepreneur / Business Owner", traits: ["E"], list: "Build and run your own business",
    why: "Ambitious, persuasive self-starters who like leading and taking risks suit entrepreneurship.",
    subjects: "No fixed subjects; Business Studies, Accounting & Maths help.",
    qual: "No degree is required, but a BCom or business diploma builds useful skills. Many start by learning and doing." },
  { id: "lawyer", name: "Lawyer", traits: ["E", "I"], list: "Advise, argue and uphold justice",
    why: "Confident, analytical people who enjoy reasoning and persuading thrive in law.",
    subjects: "Strong Languages; good marks in any subjects (Maths helps).",
    qual: "A 4-year LLB degree, then practical articles and admission as an attorney or advocate." },
  { id: "marketing", name: "Marketing & Sales", traits: ["E", "A"], list: "Promote products and win customers",
    why: "Outgoing, persuasive and creative people do well in marketing, sales and brand work.",
    subjects: "Business Studies helpful; good Languages.",
    qual: "A Diploma or Degree in Marketing, Business or Communications." },

  // Conventional
  { id: "accountant", name: "Accountant / Chartered Accountant", traits: ["C", "I"], list: "Manage money, audits and finances",
    why: "Organised, detail-focused people who are good with numbers are well suited to accounting and finance.",
    subjects: "Mathematics (essential) + Accounting.",
    qual: "A BCom Accounting degree, then SAICA articles to qualify as a Chartered Accountant (CA)." },
  { id: "banker", name: "Banking & Finance", traits: ["C", "E"], list: "Work with money, markets and clients",
    why: "If you like numbers, structure and business, finance offers stable and varied careers.",
    subjects: "Mathematics + Accounting helpful.",
    qual: "A BCom in Finance/Economics, or a finance diploma at a UoT/college." },
  { id: "logistics", name: "Logistics & Supply Chain", traits: ["C", "E"], list: "Move goods and plan operations",
    why: "Organised planners who like efficiency and coordination suit logistics and operations.",
    subjects: "Mathematics or Maths Literacy; Business Studies helpful.",
    qual: "A Diploma or Degree in Logistics, Supply Chain or Operations Management." },
];

const careerById = (id) => CAREERS.find((c) => c.id === id);

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
function advance(s, input, rawBody) {
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
    s.data.name = rawBody;
    s.step = "school";
    return [{ type: "text", text: `Nice to meet you, ${rawBody}! 🎓\n\nWhich school do you attend?` }];
  }
  if (s.step === "school") {
    s.data.school = rawBody;
    s.step = "age";
    return [{ type: "text", text: `Got it — ${rawBody}. 🏫\n\nHow old are you? (e.g. 16)` }];
  }
  if (s.step === "age") {
    const age = parseInt(input, 10);
    if (isNaN(age) || age < 12 || age > 25) return [{ type: "text", text: "Please reply with a valid age between 12 and 25." }];
    s.data.age = age;
    s.step = "suburb";
    return [{ type: "text", text: "Thanks! 🎂\n\nWhich suburb or area do you live in?" }];
  }
  if (s.step === "suburb") {
    s.data.suburb = rawBody;
    s.step = "grade";
    return [{ type: "grade", text: `📍 ${rawBody} — noted.\n\nWhat grade are you in?` }];
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

    // Finished — compute matches, present results, then ask sharing consent
    computeMatches(s);
    s.step = "share_consent";
    return [
      {
        type: "text",
        text:
          `🎉 You did it, ${s.data.name}! You answered all ${QUESTIONS.length} questions.\n\n` +
          `${gradeTip(s.data.grade)}\n\nHere's what your profile reveals 👇`,
      },
      { type: "text", text: resultsListText(s) },
      shareQuestionPiece(s.data.name),
    ];
  }

  if (s.step === "share_consent") {
    const v = (input || "").toLowerCase();
    if (v === "yes" || v === "no") {
      s.data.share_consent = v === "yes";
      s.data.share_consent_at = new Date().toISOString();
      s.step = "exploring";
      const ack = v === "yes"
        ? "🎉 Great! We'll match you with relevant colleges and bursaries, and they may reach out with opportunities. You can opt out anytime by replying *STOP*."
        : "👍 No problem — your details stay private and won't be shared. You can change your mind anytime.";
      return [
        { type: "text", text: ack },
        { type: "text", text: "Now explore your matches 👇\n\n" + menuText(s) },
      ];
    }
    return [shareQuestionPiece(s.data.name)];
  }

  if (s.step === "results" || s.step === "exploring") {
    const ids = s.data.matches || [];
    const n = parseInt(input, 10);
    if (n >= 1 && n <= ids.length) {
      s.step = "exploring";
      const c = careerById(ids[n - 1]);
      return [
        { type: "text", text: careerDetailText(s, c) },
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
      "• We'll ask a few details (name, school, age, area, grade) to give you accurate guidance.\n" +
      "• Your info is kept private and used only to help you.\n" +
      "• If you're under 18, please make sure a *parent or guardian* is happy for you to continue.\n\n" +
      `Read how we protect your info: ${PRIVACY_URL}\n\n` +
      "Tap *I agree* to begin. 👇",
  };
}

const MORE_INFO_TEXT =
  "🔒 *How Vula uses your info*\n\n" +
  "• We only collect what's needed to guide you: name, school, age, area, grade and your answers.\n" +
  "• We never ask for ID numbers, passwords or banking details.\n" +
  "• We *only* share your details with colleges or bursary programmes if you choose to be connected — and you can opt out anytime.\n" +
  "• You can reply *DELETE* at any time to remove your information.\n\n" +
  `Full policy: ${PRIVACY_URL}\n\n` +
  "Tap *I agree* to continue. 👇";

function shareQuestionPiece(name) {
  return {
    type: "share",
    text:
      `📨 One last thing, ${name}:\n\n` +
      "Would you like Vula to connect you with colleges, universities and bursary programmes that match your results? " +
      "They may contact you about opportunities.\n\n" +
      "You can say no — you'll still keep all your results.",
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
    return { phone, step: row.step, data: row.data || {}, q: row.q || 0, responses: row.responses || [] };
  }
  return null;
}

async function saveSession(s) {
  if (!hasSupabase()) { memory[s.phone] = s; return; }
  await supabaseRequest("POST", "whatsapp_sessions", {
    phone: s.phone, step: s.step, data: s.data, q: s.q, responses: s.responses, updated_at: new Date().toISOString(),
  });
}

async function deleteSession(phone) {
  if (!hasSupabase()) { delete memory[phone]; return; }
  await supabaseRequest("DELETE", `whatsapp_sessions?phone=eq.${encodeURIComponent(phone)}`);
}

// ===================== Twilio senders =====================
function twilioPost(params) {
  return new Promise((resolve) => {
    const body = new URLSearchParams(params).toString();
    const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
    const req = https.request(
      {
        hostname: "api.twilio.com",
        path: `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: d })); }
    );
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

function sendPiece(to, piece) {
  const base = { From: `whatsapp:${PHONE_NUMBER}`, To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}` };
  if (piece.type === "yesno") return twilioPost({ ...base, ContentSid: SID_YESNO, ContentVariables: JSON.stringify({ 1: piece.text }) });
  if (piece.type === "grade") return twilioPost({ ...base, ContentSid: SID_GRADE, ContentVariables: JSON.stringify({ 1: piece.text }) });
  if (piece.type === "consent") return twilioPost({ ...base, ContentSid: SID_CONSENT, ContentVariables: JSON.stringify({ 1: piece.text }) });
  if (piece.type === "share") return twilioPost({ ...base, ContentSid: SID_SHARE, ContentVariables: JSON.stringify({ 1: piece.text }) });
  return twilioPost({ ...base, Body: piece.text });
}

// ===================== Fallback rendering =====================
function renderFallback(pieces) {
  return pieces.map((p) => {
    if (p.type === "yesno") return `${p.text}\n\nReply: 0 = No   1 = Maybe   2 = Yes`;
    if (p.type === "grade") return `${p.text}\n\nReply: 10, 11 or 12`;
    if (p.type === "consent") return `${p.text}\n\nReply AGREE to continue, or MORE for more info.`;
    if (p.type === "share") return `${p.text}\n\nReply YES or NO.`;
    return p.text;
  }).join("\n\n");
}

function escapeXml(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const twimlResponse = (m) => `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(m)}</Message></Response>`;
const emptyTwiml = () => `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

// ===================== Handler =====================
module.exports = async (req, res) => {
  const body = req.body || {};
  const from = body.From || "";
  const rawBody = (body.Body || "").trim();
  const buttonPayload = (body.ButtonPayload || "").trim();
  const input = buttonPayload || rawBody;

  const cmd = rawBody.toUpperCase();

  // POPIA: let users delete their data or stop messages at any time.
  if (cmd === "DELETE") {
    await deleteSession(from);
    const pieces = [{ type: "text", text: "🗑️ Done — your information has been deleted from Vula. Reply *Hi* anytime to start fresh." }];
    return await respond(res, from, pieces);
  }
  if (cmd === "STOP") {
    const pieces = [{ type: "text", text: "👋 You won't receive more messages from Vula. Reply *Hi* anytime to resume. To delete your info, reply *DELETE*." }];
    return await respond(res, from, pieces);
  }
  if (cmd === "RESTART") await deleteSession(from);

  let session = await loadSession(from);
  let pieces;
  if (!session) {
    session = { phone: from, step: "consent", data: {}, q: 0, responses: [] };
    pieces = [welcomePiece()];
  } else {
    pieces = advance(session, input, rawBody);
  }
  await saveSession(session);
  return await respond(res, from, pieces);
};

// Sends pieces via Twilio (buttons), or replies with plain-text TwiML fallback.
async function respond(res, from, pieces) {
  if (hasTwilio()) {
    try {
      for (const piece of pieces) await sendPiece(from, piece);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml");
      res.end(emptyTwiml());
      return;
    } catch (e) { /* fall through */ }
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/xml");
  res.end(twimlResponse(renderFallback(pieces)));
}
