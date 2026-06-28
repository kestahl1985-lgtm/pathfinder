// Pathfinder WhatsApp webhook.
//
// • Multiple-choice steps (grade + the 5 questions) send tappable WhatsApp
//   quick-reply BUTTONS via Twilio's Content API.
// • Conversation state is PERSISTED in Supabase (table: whatsapp_sessions),
//   so a learner can pause and resume later and the flow never resets.
// • Everything degrades gracefully: if Supabase isn't configured it falls
//   back to in-memory state; if Twilio creds are missing it falls back to a
//   plain-text TwiML reply. The bot always responds.

const https = require("https");

// --- Twilio config ---
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SID_YESNO = process.env.CONTENT_SID_YESNO || "HX94ea41518e35dd7bd5c666b8b2f968d6";
const SID_GRADE = process.env.CONTENT_SID_GRADE || "HX8c9397cd6d8cc5c9cac8c478e51768ab";

// --- Supabase config ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasTwilio = () => Boolean(ACCOUNT_SID && AUTH_TOKEN && PHONE_NUMBER);
const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_KEY);

// In-memory fallback store (used only when Supabase is not configured)
const memory = {};

const QUESTIONS = [
  "Do you prefer building or fixing things with your hands?",
  "Would you enjoy solving complex scientific problems?",
  "Do you like creating art, music, or written content?",
  "Do you enjoy helping or teaching other people?",
  "Would you like to lead or manage a team?",
];

function freshSession(phone) {
  return { phone, step: "name", data: {}, q: 0, responses: [] };
}

function questionText(index) {
  return `Question ${index + 1} of ${QUESTIONS.length}\n\n${QUESTIONS[index]}`;
}

// ===================== State machine =====================
// Advances an EXISTING session in place. Returns an array of reply pieces:
//   { type: "text" | "yesno" | "grade", text }
function advance(s, input, rawBody) {
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
    if (isNaN(age) || age < 12 || age > 25) {
      return [{ type: "text", text: "Please reply with a valid age between 12 and 25." }];
    }
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
    if (![10, 11, 12].includes(grade)) {
      return [{ type: "grade", text: "Please choose your grade below 👇" }];
    }
    s.data.grade = grade;
    s.step = "assessment";
    s.q = 0;
    return [
      {
        type: "text",
        text:
          `✅ Thanks ${s.data.name}, your profile is set!\n\n` +
          `• School: ${s.data.school}\n` +
          `• Age: ${s.data.age}\n` +
          `• Area: ${s.data.suburb}\n` +
          `• Grade: ${grade}\n\n` +
          "📋 *Now the fun part.*\n\n" +
          "There are no right or wrong answers — just be honest about what feels like *you*. " +
          "Your answers reveal your natural strengths and the careers where you'll thrive. 💡",
      },
      { type: "yesno", text: questionText(0) },
    ];
  }

  if (s.step === "assessment") {
    const answer = parseInt(input, 10);
    if (![0, 1, 2].includes(answer)) {
      return [{ type: "yesno", text: "Please tap one of the options below 👇\n\n" + questionText(s.q) }];
    }
    s.responses.push(answer);
    s.q += 1;

    if (s.q < QUESTIONS.length) {
      return [{ type: "yesno", text: questionText(s.q) }];
    }

    s.step = "done";
    const avg = (s.responses.reduce((a, b) => a + b, 0) / s.responses.length).toFixed(1);
    return [
      {
        type: "text",
        text:
          `🎉 You did it, ${s.data.name}!\n\n` +
          "That's a real step most learners never take — you've started shaping your future on purpose. 🌟\n\n" +
          "We're now matching your strengths to careers, the subjects you'll need, and colleges and bursaries that fit *you*. " +
          "You'll get your personalised path shortly.\n\n" +
          "Remember: the earlier you know your direction, the more choices you keep open. You're ahead of the game. 🚀\n\n" +
          "_Reply RESTART anytime to take it again._",
      },
    ];
  }

  if (s.step === "done") {
    return [{ type: "text", text: "You've already completed your assessment ✅\n\nReply RESTART to take it again." }];
  }

  return [{ type: "text", text: "Sorry, something went wrong. Reply RESTART to begin again." }];
}

function welcomePiece() {
  return {
    type: "text",
    text:
      "👋 Welcome to *Pathfinder* — your free career guide on WhatsApp!\n\n" +
      "Choosing a career can feel overwhelming. Most learners only start thinking about it in matric — but the subjects you pick in Grade 9, 10 and 11 already shape the doors that stay open to you. 🚪\n\n" +
      "Pathfinder helps you discover *what you're naturally good at*, the careers that fit you, and the exact subjects and marks you'll need to get there — before it's too late to change course.\n\n" +
      "It takes about 5 minutes, you can pause and pick up anytime, and it's completely free. 🌱\n\n" +
      "Let's begin! What's your *first name*?",
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

    const req = https.request(
      { hostname: url.hostname, path: `/rest/v1/${path}`, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ ok: res.statusCode < 300, status: res.statusCode, json: data ? JSON.parse(data) : null });
          } catch {
            resolve({ ok: res.statusCode < 300, status: res.statusCode, json: null });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

async function loadSession(phone) {
  if (!hasSupabase()) return memory[phone] || null;
  const enc = encodeURIComponent(phone);
  const r = await supabaseRequest("GET", `whatsapp_sessions?phone=eq.${enc}&limit=1`);
  if (r.ok && Array.isArray(r.json) && r.json.length) {
    const row = r.json[0];
    return { phone, step: row.step, data: row.data || {}, q: row.q || 0, responses: row.responses || [] };
  }
  return null;
}

async function saveSession(s) {
  if (!hasSupabase()) {
    memory[s.phone] = s;
    return;
  }
  await supabaseRequest("POST", "whatsapp_sessions", {
    phone: s.phone,
    step: s.step,
    data: s.data,
    q: s.q,
    responses: s.responses,
    updated_at: new Date().toISOString(),
  });
}

async function deleteSession(phone) {
  if (!hasSupabase()) {
    delete memory[phone];
    return;
  }
  const enc = encodeURIComponent(phone);
  await supabaseRequest("DELETE", `whatsapp_sessions?phone=eq.${enc}`);
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
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data }));
      }
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
  return twilioPost({ ...base, Body: piece.text });
}

// ===================== Fallback rendering =====================
function renderFallback(pieces) {
  return pieces
    .map((p) => {
      if (p.type === "yesno") return `${p.text}\n\nReply: 0 = No   1 = Maybe   2 = Yes`;
      if (p.type === "grade") return `${p.text}\n\nReply: 10, 11 or 12`;
      return p.text;
    })
    .join("\n\n");
}

function escapeXml(t) {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

  let pieces;

  if (rawBody.toUpperCase() === "RESTART") {
    await deleteSession(from);
  }

  let session = await loadSession(from);

  if (!session) {
    // Brand-new (or just reset) conversation
    session = freshSession(from);
    pieces = [welcomePiece()];
  } else {
    pieces = advance(session, input, rawBody);
  }

  await saveSession(session);

  // Preferred: real buttons via Twilio API, then ack with empty TwiML
  if (hasTwilio()) {
    try {
      for (const piece of pieces) await sendPiece(from, piece);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml");
      res.end(emptyTwiml());
      return;
    } catch (e) {
      // fall through to text fallback
    }
  }

  // Fallback: plain-text TwiML (always works)
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/xml");
  res.end(twimlResponse(renderFallback(pieces)));
};
