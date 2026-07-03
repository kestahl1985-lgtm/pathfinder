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
  welcomePiece,
  reportPiece,
  loadSession,
  saveSession,
  deleteSession,
  rateLimited,
} = require("../lib/assessment.js");

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

// Button ids double as the values advance() parses (e.g. "0"/"1"/"2" for
// yesno, "agree"/"more" for consent) — chosen to match lib/assessment.js's
// existing parsing exactly, so no change was needed there.
function buttons(list) {
  return list.map(([id, title]) => ({ type: "reply", reply: { id, title } }));
}

function sendPiece(to, piece) {
  const base = { messaging_product: "whatsapp", to };
  if (piece.type === "yesno") {
    return graphPost({
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: piece.text },
        action: { buttons: buttons([["0", "No"], ["1", "Maybe"], ["2", "Yes"]]) },
      },
    });
  }
  if (piece.type === "grade") {
    return graphPost({
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: piece.text },
        action: { buttons: buttons([["10", "Grade 10"], ["11", "Grade 11"], ["12", "Grade 12"]]) },
      },
    });
  }
  if (piece.type === "consent") {
    return graphPost({
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: piece.text },
        action: { buttons: buttons([["agree", "I agree"], ["more", "More info"]]) },
      },
    });
  }
  if (piece.type === "media") {
    return graphPost({
      ...base,
      type: "document",
      document: { link: piece.mediaUrl, caption: piece.text, filename: "Vula-Career-Report.pdf" },
    });
  }
  return graphPost({ ...base, type: "text", text: { body: piece.text } });
}

async function respond(from, pieces) {
  if (hasMeta()) {
    await Promise.all(pieces.map((piece) => sendPiece(from, piece)));
  }
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
  if (APP_SECRET && process.env.META_VALIDATION !== "off") {
    if (!validateMetaSignature(rawBodyBuffer, req.headers["x-hub-signature-256"])) {
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

  const { from, messageId, rawBody, buttonPayload } = parsed;
  const input = buttonPayload || rawBody;

  // --- Rate limit per sender (defence in depth) ---
  if (from && rateLimited(from)) {
    res.statusCode = 429;
    res.end("Too Many Requests");
    return;
  }

  const cmd = rawBody.toUpperCase();

  // POPIA: let users delete their data or stop messages at any time.
  if (cmd === "DELETE") {
    await deleteSession(from);
    await respond(from, [{ type: "text", text: "🗑️ Done — your information has been deleted from Vula. Reply *Hi* anytime to start fresh." }]);
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
    return;
  }
  if (cmd === "STOP") {
    await respond(from, [{ type: "text", text: "👋 You won't receive more messages from Vula. Reply *Hi* anytime to resume. To delete your info, reply *DELETE*." }]);
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
    return;
  }
  if (cmd === "REPORT") {
    const sess = await loadSession(from);
    if (sess && sess.report_token) {
      await respond(from, [reportPiece(sess)]);
    } else {
      await respond(from, [{ type: "text", text: "You'll get your report once you finish the assessment. Reply *Hi* to begin." }]);
    }
    res.statusCode = 200;
    res.end("EVENT_RECEIVED");
    return;
  }
  if (cmd === "RESTART") await deleteSession(from);

  let session = await loadSession(from);

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
    session = { phone: from, step: "consent", data: {}, q: 0, responses: [] };
    pieces = [welcomePiece()];
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

  await respond(from, pieces);
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
