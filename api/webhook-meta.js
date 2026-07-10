// Vula WhatsApp webhook — Meta Cloud API (direct, no Twilio/BSP markup).
//
// Same product as api/webhook.js (Twilio) — same questions, same scoring,
// same career/sponsor matching, same session storage — just a different
// wire format for receiving and sending WhatsApp messages. Shared logic
// lives in ../lib/assessment.js.
//
// Setup this file needs once real credentials exist:
//   META_ACCESS_TOKEN   - permanent System User token (whatsapp_business_messaging)
//   META_PHONE_NUMBER_ID - the WhatsApp phone number's ID (not the number itself)
//   META_APP_SECRET     - used to verify X-Hub-Signature-256 on inbound webhooks
//   META_VERIFY_TOKEN   - a string you choose yourself, entered into Meta's
//                         webhook config UI, used for the one-time GET handshake
//   META_GRAPH_VERSION  - optional, defaults below

const https = require("https");
const crypto = require("crypto");

const {
  advance,
  reportPiece,
  loadSession,
  saveSession,
  deleteSession,
  rateLimited,
  langOf,
} = require("../lib/assessment.js");
const i18n = require("../lib/i18n.js");

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

const hasMeta = () => Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID);

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ===================== Security =====================
// Verify the request genuinely came from Meta (X-Hub-Signature-256): a
// HMAC-SHA256 of the raw request body, keyed with the app secret.
function validateMetaSignature(rawBody, header) {
  if (!header || !APP_SECRET) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

// ===================== Meta Graph API senders =====================
function graphPost(payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: "graph.facebook.com",
        path: `/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ACCESS_TOKEN}`,
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

// Button ids are fixed (they're what lib/assessment.js's advance() parses),
// only the titles are localized — lib/assessment.js attaches piece.buttons
// as an array of titles in the learner's chosen language, in the same
// order as the fixed ids below.
function buttons(ids, titles) {
  return ids.map((id, i) => ({ type: "reply", reply: { id, title: titles[i] } }));
}

function sendPiece(to, piece) {
  const base = { messaging_product: "whatsapp", to };
  if (piece.type === "language") {
    return graphPost({
      ...base,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: i18n.t(i18n.DEFAULT_LANG, piece.retry ? "languageQuestionRetry" : "languageQuestion") },
        action: {
          button: i18n.t(i18n.DEFAULT_LANG, "languageListButton"),
          sections: [{ rows: i18n.LANGUAGES.map((l) => ({ id: l.id, title: l.title })) }],
        },
      },
    });
  }
  if (piece.type === "yesno") {
    return graphPost({
      ...base,
      type: "interactive",
      interactive: { type: "button", body: { text: piece.text }, action: { buttons: buttons(["0", "1", "2"], piece.buttons) } },
    });
  }
  if (piece.type === "consent") {
    return graphPost({
      ...base,
      type: "interactive",
      interactive: { type: "button", body: { text: piece.text }, action: { buttons: buttons(["agree", "more"], piece.buttons) } },
    });
  }
  if (piece.type === "media") {
    return graphPost({
      ...base,
      type: "document",
      document: { link: piece.mediaUrl, caption: piece.text, filename: piece.filename || "Vula-Career-Report.pdf" },
    });
  }
  return graphPost({ ...base, type: "text", text: { body: piece.text } });
}

// Pieces are sent one at a time, in order — sending them in parallel let
// independent API calls race and arrive out of order (e.g. a question
// appearing before the "let's start the assessment" message that precedes
// it), which is worse than the small added latency of sending sequentially.
async function respond(from, pieces) {
  if (hasMeta()) {
    for (const piece of pieces) {
      // graphPost() never rejects (network errors resolve to {ok:false} too),
      // so a delivery failure here was previously silent — log it so an
      // outage or a rejected send is actually visible instead of just
      // looking like the learner "went quiet".
      const result = await sendPiece(from, piece);
      if (!result.ok) {
        console.error(`Meta send failed for ${from} (${piece.type}): status=${result.status || "n/a"} error=${result.error || ""} body=${(result.data || "").slice(0, 300)}`);
      }
    }
  }
}

// Meta's Cloud API identifies the sender as bare E.164 digits (e.g.
// "27821234567"), no "+", no prefix. api/webhook.js (Twilio) keys sessions
// as "whatsapp:+27821234567". Normalize to that same shape so a session
// started on one channel is still reachable after switching the webhook
// target between them, and the two can never silently fork the same
// learner into two different session rows if ever active at once.
function toSessionPhone(rawFrom) {
  return `whatsapp:+${rawFrom.replace(/[^\d]/g, "")}`;
}

// ===================== Inbound parsing =====================
// Pulls the one message we care about out of Meta's nested webhook shape:
// entry[].changes[].value.messages[]. A webhook call can also carry
// delivery/read status updates (value.statuses[]) instead of a message —
// those are acked and ignored.
function extractMessage(body) {
  const entry = (body.entry || [])[0];
  const change = entry && (entry.changes || [])[0];
  const value = change && change.value;
  const message = value && (value.messages || [])[0];
  if (!message) return null;

  const from = message.from || "";
  const messageId = message.id || "";
  let rawBody = "";
  let buttonPayload = "";

  if (message.type === "text") {
    rawBody = (message.text && message.text.body ? message.text.body : "").trim();
  } else if (message.type === "interactive") {
    const interactive = message.interactive || {};
    const reply = interactive.button_reply || interactive.list_reply;
    if (reply) buttonPayload = (reply.id || "").trim();
  }

  return { from, messageId, rawBody, buttonPayload };
}

// ===================== Handler =====================
module.exports = async (req, res) => {
  // --- Webhook verification handshake (one-time, when configuring the
  // webhook URL in Meta's App Dashboard) ---
  if (req.method === "GET") {
    const q = new URL(req.url, "https://placeholder").searchParams;
    if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === VERIFY_TOKEN && VERIFY_TOKEN) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end(q.get("hub.challenge") || "");
      return;
    }
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  const rawBodyBuffer = await readRawBody(req);

  // --- Security gate: only accept genuine, signed Meta requests ---
  // Fails CLOSED, not open: if META_APP_SECRET isn't set yet (e.g. Meta
  // account setup still in progress), reject every POST rather than
  // process it unvalidated. This endpoint is publicly reachable regardless
  // of whether Meta itself is actually configured to call it, so accepting
  // unsigned payloads whenever the secret happens to be missing would let
  // anyone forge webhook calls (DELETE a real learner's session, create
  // fake sessions for arbitrary phone numbers) simply by POSTing Meta's
  // publicly-documented payload shape. There's no legitimate traffic this
  // could break — Meta can't be sending real webhooks here until
  // META_APP_SECRET exists anyway.
  if (process.env.META_VALIDATION !== "off") {
    if (!APP_SECRET || !validateMetaSignature(rawBodyBuffer, req.headers["x-hub-signature-256"])) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/plain");
      res.end("Forbidden");
      return;
    }
  }

  let body;
  try { body = JSON.parse(rawBodyBuffer.toString("utf-8") || "{}"); }
  catch { body = {}; }

  const parsed = extractMessage(body);
  if (!parsed) {
    // Status callback (delivered/read) or an event we don't act on — ack and stop.
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
    return;
  }

  const { from: rawFrom, messageId, rawBody, buttonPayload } = parsed;
  // rawFrom (Meta's bare-digits shape) is what the Graph API needs as the
  // "to" recipient when replying; from (normalized) is what session storage
  // uses as the key — see toSessionPhone() above for why these differ.
  const from = toSessionPhone(rawFrom);
  const input = buttonPayload || rawBody;

  // --- Rate limit per sender (defence in depth) ---
  if (from && rateLimited(from)) {
    res.statusCode = 429;
    res.end("Too Many Requests");
    return;
  }

  const cmd = rawBody.toUpperCase();
  let session = await loadSession(from);
  const cmdLang = session ? langOf(session) : i18n.DEFAULT_LANG;

  // POPIA: let users delete their data or stop messages at any time.
  if (cmd === "DELETE") {
    await deleteSession(from);
    await respond(rawFrom, [{ type: "text", text: i18n.t(cmdLang, "deleteConfirm") }]);
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
    return;
  }
  if (cmd === "STOP") {
    await respond(rawFrom, [{ type: "text", text: i18n.t(cmdLang, "stopConfirm") }]);
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
    return;
  }
  if (cmd === "REPORT") {
    if (session && session.report_token) {
      await respond(rawFrom, [reportPiece(session)]);
    } else {
      await respond(rawFrom, [{ type: "text", text: i18n.t(cmdLang, "reportNotReady") }]);
    }
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
    return;
  }
  if (cmd === "RESTART") { await deleteSession(from); session = null; }

  // Meta retries a webhook it didn't get a fast enough 200 for. If this
  // exact message was already processed (same message id recorded on the
  // session), don't replay the state machine — just ack quietly so we
  // don't double-count an answer or double-send messages.
  if (session && messageId && session.data._last_message_sid === messageId) {
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
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
  if (messageId) session.data._last_message_sid = messageId;

  const saved = await saveSession(session, { isNew });
  if (!saved) {
    // Lost a race to a concurrent request for the same phone (e.g. a retry
    // landing alongside the original) — the other request's save won and
    // will have sent its own reply, so don't send a duplicate one here.
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
    return;
  }

  await respond(rawFrom, pieces);
  res.statusCode = 200;
  res.end("EVENT_RECEIVED");
};

// Vercel/Next-style API route config: disable automatic body parsing so we
// can read the exact raw bytes Meta signed (X-Hub-Signature-256 is computed
// over the raw request body — verifying against a re-serialised JSON.stringify
// of the parsed body can mismatch on whitespace/key-order and silently break
// signature checks). Must be set after module.exports is assigned the
// handler function, not before — assigning module.exports = fn later would
// otherwise wipe out a .config set earlier.
module.exports.config = { api: { bodyParser: false } };
