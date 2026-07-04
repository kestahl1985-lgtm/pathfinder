// Vula WhatsApp webhook — Twilio.
//
// Flow: onboarding → 30-question RIASEC assessment (tappable buttons) →
// matched career list with reasoning → tap a number to explore a career
// (why it fits, subjects, qualifications) → go back and explore others.
//
// Buttons via Twilio Content API; state persisted in Supabase
// (whatsapp_sessions). Degrades to plain-text TwiML / in-memory if either
// service is unconfigured, so it always responds.
//
// Assessment questions, scoring, career/sponsor matching and session
// persistence live in ../lib/assessment.js, shared with the Meta Cloud API
// handler (api/webhook-meta.js) — this file only handles the Twilio-specific
// wire format (signature validation, Content API sends, TwiML responses).

const https = require("https");
const crypto = require("crypto");

const {
  advance,
  reportPiece,
  loadSession,
  saveSession,
  deleteSession,
  rateLimited,
} = require("../lib/assessment.js");
const { LANGUAGES } = require("../lib/i18n.js");

// --- Twilio ---
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SID_YESNO = process.env.CONTENT_SID_YESNO || "HX94ea41518e35dd7bd5c666b8b2f968d6";
const SID_GRADE = process.env.CONTENT_SID_GRADE || "HX8c9397cd6d8cc5c9cac8c478e51768ab";
const SID_CONSENT = process.env.CONTENT_SID_CONSENT || "HX389c1fc2e0a23ff51e7145227d8b8287";

const hasTwilio = () => Boolean(ACCOUNT_SID && AUTH_TOKEN && PHONE_NUMBER);

// ===================== Security =====================
// Verify the request genuinely came from Twilio (X-Twilio-Signature).
// Twilio signs: the full request URL + each POST param (sorted by key,
// concatenated as key+value), HMAC-SHA1 with the auth token, base64.
// We test a few candidate URLs to tolerate Vercel's path rewrite; set
// WEBHOOK_URL in env to the exact configured URL for certainty.
function validateTwilioSignature(req) {
  const sig = req.headers["x-twilio-signature"];
  if (!sig || !AUTH_TOKEN) return false;
  const params = req.body && typeof req.body === "object" ? req.body : {};
  const sortedKeys = Object.keys(params).sort();
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const candidates = [];
  if (process.env.WEBHOOK_URL) candidates.push(process.env.WEBHOOK_URL);
  if (host) {
    candidates.push(`https://${host}/webhook`);
    if (req.url) candidates.push(`https://${host}${req.url}`);
  }
  return candidates.some((url) => {
    let data = url;
    for (const k of sortedKeys) data += k + params[k];
    const expected = crypto.createHmac("sha1", AUTH_TOKEN).update(Buffer.from(data, "utf-8")).digest("base64");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  });
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

// NOTE: the yesno/grade/consent Content Templates (SID_YESNO etc.) have
// their button labels baked in at the time they were registered in Twilio's
// console — only the question/prompt *text* is dynamic via
// ContentVariables. That means on the Twilio path those three button labels
// stay in English regardless of the learner's chosen language, even though
// the surrounding text is localized. Not fixed here since Twilio isn't the
// long-term path (see api/webhook-meta.js, which builds buttons fresh per
// send and fully localizes them) — fixing this on Twilio would mean
// registering 4 language variants of each template in the console.
function sendPiece(to, piece) {
  const base = { From: `whatsapp:${PHONE_NUMBER}`, To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}` };
  if (piece.type === "language") return twilioPost({ ...base, Body: languageListText() });
  if (piece.type === "yesno") return twilioPost({ ...base, ContentSid: SID_YESNO, ContentVariables: JSON.stringify({ 1: piece.text }) });
  if (piece.type === "grade") return twilioPost({ ...base, ContentSid: SID_GRADE, ContentVariables: JSON.stringify({ 1: piece.text }) });
  if (piece.type === "consent") return twilioPost({ ...base, ContentSid: SID_CONSENT, ContentVariables: JSON.stringify({ 1: piece.text }) });
  if (piece.type === "media") return twilioPost({ ...base, Body: piece.text, MediaUrl: piece.mediaUrl });
  return twilioPost({ ...base, Body: piece.text });
}

// No Twilio List Picker template is registered for language selection, so
// this is always sent as a plain numbered list; lib/assessment.js's
// pickLanguage() accepts the reply as either a number or a language id.
function languageListText() {
  return "🌍 Which language would you like to use?\n\n" + LANGUAGES.map((l, i) => `${i + 1}. ${l.title}`).join("\n");
}

// ===================== Fallback rendering =====================
function renderFallback(pieces) {
  return pieces.map((p) => {
    if (p.type === "language") return languageListText();
    if (p.type === "yesno") return `${p.text}\n\nReply: 0 = No   1 = Maybe   2 = Yes`;
    if (p.type === "grade") return `${p.text}\n\nReply: 10, 11 or 12`;
    if (p.type === "consent") return `${p.text}\n\nReply AGREE to continue, or MORE for more info.`;
    if (p.type === "media") return `${p.text}\n\n${p.mediaUrl}`;
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
  // --- Security gate: only accept genuine, signed Twilio requests ---
  // Enforced whenever Twilio is configured. Set TWILIO_VALIDATION=off only
  // as a temporary escape hatch (not recommended).
  if (hasTwilio() && process.env.TWILIO_VALIDATION !== "off") {
    if (!validateTwilioSignature(req)) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/plain");
      res.end("Forbidden");
      return;
    }
  }

  const body = req.body || {};
  const from = body.From || "";
  const rawBody = (body.Body || "").trim();
  const buttonPayload = (body.ButtonPayload || "").trim();
  const input = buttonPayload || rawBody;
  const messageSid = body.MessageSid || "";

  // --- Rate limit per sender (defence in depth) ---
  if (from && rateLimited(from)) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "text/plain");
    res.end("Too Many Requests");
    return;
  }

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
  if (cmd === "REPORT") {
    const sess = await loadSession(from);
    if (sess && sess.report_token) return await respond(res, from, [reportPiece(sess)]);
    return await respond(res, from, [{ type: "text", text: "You'll get your report once you finish the assessment. Reply *Hi* to begin." }]);
  }
  if (cmd === "RESTART") await deleteSession(from);

  let session = await loadSession(from);

  // Twilio retries a webhook it didn't get a fast enough response to. If
  // this exact message was already processed (same MessageSid recorded on
  // the session), don't replay the state machine — just ack quietly so we
  // don't double-count an answer or double-send messages.
  if (session && messageSid && session.data._last_message_sid === messageSid) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml");
    res.end(emptyTwiml());
    return;
  }

  const isNew = !session;
  let pieces;
  if (isNew) {
    session = { phone: from, step: "language", data: {}, q: 0, responses: [] };
    pieces = [{ type: "language" }];
  } else {
    pieces = await advance(session, input, rawBody);
  }
  if (messageSid) session.data._last_message_sid = messageSid;

  const saved = await saveSession(session, { isNew });
  if (!saved) {
    // Lost a race to a concurrent request for the same phone (e.g. a retry
    // landing alongside the original) — the other request's save won and
    // will have sent its own reply, so don't send a duplicate one here.
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml");
    res.end(emptyTwiml());
    return;
  }
  return await respond(res, from, pieces);
};

// Sends pieces via Twilio (buttons), or replies with plain-text TwiML fallback.
// Pieces are sent in parallel rather than one-at-a-time so a multi-message
// reply (e.g. results + report + menu) doesn't stack up latency and risk
// missing Twilio's webhook response window. WhatsApp delivery order across
// independent API calls sent milliseconds apart isn't strictly guaranteed,
// but in practice arrives in submission order; this is a deliberate
// latency/ordering trade-off.
async function respond(res, from, pieces) {
  if (hasTwilio()) {
    try {
      await Promise.all(pieces.map((piece) => sendPiece(from, piece)));
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
