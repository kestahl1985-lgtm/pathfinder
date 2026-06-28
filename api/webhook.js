// Pathfinder WhatsApp webhook.
//
// Multiple-choice steps (grade + the 5 questions) are sent as tappable
// WhatsApp quick-reply BUTTONS via Twilio's Content API. If Twilio
// credentials are not configured (or an API send fails), the webhook
// automatically falls back to a plain-text TwiML reply so it ALWAYS responds.
//
// State is in-memory (persists while a lambda stays warm) — moved to
// Supabase next for full reliability.

const https = require("https");

// --- Twilio config (creds from env; Content SIDs created via Content API) ---
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SID_YESNO = process.env.CONTENT_SID_YESNO || "HX94ea41518e35dd7bd5c666b8b2f968d6";
const SID_GRADE = process.env.CONTENT_SID_GRADE || "HX8c9397cd6d8cc5c9cac8c478e51768ab";

function hasCreds() {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && PHONE_NUMBER);
}

const sessions = {};

const QUESTIONS = [
  "Do you prefer building or fixing things with your hands?",
  "Would you enjoy solving complex scientific problems?",
  "Do you like creating art, music, or written content?",
  "Do you enjoy helping or teaching other people?",
  "Would you like to lead or manage a team?",
];

// ---------- Reply builders ----------
// Each reply piece is one of:
//   { type: "text",  text }
//   { type: "yesno", text }   -> No / Maybe / Yes buttons
//   { type: "grade", text }   -> Grade 10 / 11 / 12 buttons

function questionText(index) {
  return `Question ${index + 1} of ${QUESTIONS.length}\n\n${QUESTIONS[index]}`;
}

// ---------- State machine ----------
// Returns an array of reply pieces.
function getReplies(from, input, rawBody) {
  let s = sessions[from];

  if (!s) {
    sessions[from] = { step: "name", data: {}, q: 0, responses: [] };
    return [
      {
        type: "text",
        text:
          "👋 Welcome to *Pathfinder* — your free career guide on WhatsApp!\n\n" +
          "Choosing a career can feel overwhelming. Most learners only start thinking about it in matric — but the subjects you pick in Grade 9, 10 and 11 already shape the doors that stay open to you. 🚪\n\n" +
          "Pathfinder helps you discover *what you're naturally good at*, the careers that fit you, and the exact subjects and marks you'll need to get there — before it's too late to change course.\n\n" +
          "It takes about 5 minutes, it's completely free, and the path is yours to keep. 🌱\n\n" +
          "Let's begin! What's your *first name*?",
      },
    ];
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

// ---------- Senders ----------
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

async function sendPiece(to, piece) {
  const base = { From: `whatsapp:${PHONE_NUMBER}`, To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}` };
  if (piece.type === "yesno") {
    return twilioPost({ ...base, ContentSid: SID_YESNO, ContentVariables: JSON.stringify({ 1: piece.text }) });
  }
  if (piece.type === "grade") {
    return twilioPost({ ...base, ContentSid: SID_GRADE, ContentVariables: JSON.stringify({ 1: piece.text }) });
  }
  return twilioPost({ ...base, Body: piece.text });
}

// Plain-text rendering for the TwiML fallback (no buttons available).
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

function twimlResponse(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

function emptyTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

module.exports = async (req, res) => {
  const body = req.body || {};
  const from = body.From || "";
  const rawBody = (body.Body || "").trim();
  // Button taps arrive as ButtonPayload (the id we set: "0".."2", "10".."12")
  const buttonPayload = (body.ButtonPayload || "").trim();
  const input = buttonPayload || rawBody;

  // Hard reset
  if (rawBody.toUpperCase() === "RESTART") {
    delete sessions[from];
  }

  const pieces = getReplies(from, input, rawBody);

  // Preferred path: real buttons via Twilio API, then ack Twilio with empty TwiML.
  if (hasCreds()) {
    try {
      for (const piece of pieces) {
        await sendPiece(from, piece);
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml");
      res.end(emptyTwiml());
      return;
    } catch (e) {
      // fall through to text fallback
    }
  }

  // Fallback: plain-text TwiML (always works, no buttons).
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/xml");
  res.end(twimlResponse(renderFallback(pieces)));
};
