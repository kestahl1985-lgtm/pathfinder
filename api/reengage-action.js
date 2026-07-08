// Admin-triggered action on a queued re-engagement entry (api/reengage.js
// populates the queue; this is how an admin actually sends or dismisses
// one). POST { queueId, action: "send" | "skip" } with
// Authorization: Bearer <supabase access token> from a logged-in admin
// session — same auth pattern as api/send-message.js.
//
// "send" delivers the grade_progress_nudge WhatsApp template via the Meta
// Cloud API (a template is required here, not free-form text, since this is
// well outside WhatsApp's 24h reply window — see api/reengage.js's header).
// That template must be created and approved in Meta Business Manager
// before this can actually deliver anything (see WHATSAPP_PRODUCTION.md) —
// until then this will fail cleanly with an error surfaced to the admin,
// not a silent no-op.

const https = require("https");
const { loadSession, saveSession, langOf } = require("../lib/assessment.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

const ALLOWED_ORIGINS = ["https://admin.vulacareers.co.za", "https://pathfinder-admin-pi.vercel.app"];
const TEMPLATE_LANG = { en: "en_US", zu: "zu", xh: "xh", af: "af" };

function setCors(req, res) {
  const origin = req.headers.origin;
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function supaGet(path) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const req = https.request(
      { hostname: url.hostname, path: `/rest/v1/${path}`, method: "GET", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } }); }
    );
    req.on("error", () => resolve(null));
    req.end();
  });
}

function supaPatch(path, body) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const payload = JSON.stringify(body);
    const req = https.request(
      { hostname: url.hostname, path: `/rest/v1/${path}`, method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => { res.on("data", () => {}); res.on("end", () => resolve(res.statusCode < 300)); }
    );
    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

function verifyAdminToken(token) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const req = https.request(
      { hostname: url.hostname, path: "/auth/v1/user", method: "GET", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => { if (res.statusCode !== 200) return resolve(null); try { resolve(JSON.parse(d).email || null); } catch { resolve(null); } });
      }
    );
    req.on("error", () => resolve(null));
    req.end();
  });
}

async function isAllowlisted(email) {
  if (!email) return false;
  const rows = await supaGet(`admin_allowlist?email=eq.${encodeURIComponent(email.toLowerCase())}&select=email`);
  return Array.isArray(rows) && rows.length > 0;
}

function sendNudgeTemplate(phone, session) {
  return new Promise((resolve) => {
    const lang = langOf(session);
    const payload = {
      messaging_product: "whatsapp",
      to: phone.replace(/^whatsapp:/, ""),
      type: "template",
      template: {
        name: "grade_progress_nudge",
        language: { code: TEMPLATE_LANG[lang] || TEMPLATE_LANG.en },
        components: [{ type: "body", parameters: [{ type: "text", text: session.data.name || "there" }] }],
      },
    };
    const body = JSON.stringify(payload);
    const req = https.request(
      { hostname: "graph.facebook.com", path: `/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Length": Buffer.byteLength(body) } },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { let parsed = {}; try { parsed = JSON.parse(d); } catch {} resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed }); }); }
    );
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) { res.statusCode = 500; res.end(JSON.stringify({ error: "Not configured" })); return; }

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.statusCode = 401; res.end(JSON.stringify({ error: "Missing admin session" })); return; }

  const email = await verifyAdminToken(token);
  if (!email) { res.statusCode = 401; res.end(JSON.stringify({ error: "Invalid or expired session" })); return; }

  const allowed = await isAllowlisted(email);
  if (!allowed) { res.statusCode = 403; res.end(JSON.stringify({ error: "Not an admin" })); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const queueId = String(body.queueId || "").trim();
  const action = String(body.action || "").trim();
  if (!queueId || !["send", "skip"].includes(action)) {
    res.statusCode = 400; res.end(JSON.stringify({ error: "queueId and action ('send' or 'skip') are required" })); return;
  }

  const rows = await supaGet(`reengagement_queue?id=eq.${encodeURIComponent(queueId)}&status=eq.pending&select=*&limit=1`);
  const entry = Array.isArray(rows) && rows[0];
  if (!entry) { res.statusCode = 404; res.end(JSON.stringify({ error: "No pending queue entry with that id" })); return; }

  if (action === "skip") {
    await supaPatch(`reengagement_queue?id=eq.${encodeURIComponent(queueId)}`, { status: "skipped", actioned_at: new Date().toISOString(), actioned_by: email });
    res.statusCode = 200; res.end(JSON.stringify({ ok: true, status: "skipped" }));
    return;
  }

  // action === "send"
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    res.statusCode = 500; res.end(JSON.stringify({ error: "Meta WhatsApp credentials not configured yet" })); return;
  }
  const session = await loadSession(entry.phone);
  if (!session) { res.statusCode = 404; res.end(JSON.stringify({ error: "No learner session found for that phone" })); return; }

  const result = await sendNudgeTemplate(entry.phone, session);
  if (!result.ok) {
    // Likely means grade_progress_nudge isn't approved in Meta Business Manager yet.
    const msg = (result.data && result.data.error && result.data.error.message) || result.error || `HTTP ${result.status}`;
    res.statusCode = 502; res.end(JSON.stringify({ ok: false, error: msg }));
    return;
  }

  session.data.nudges_sent = (session.data.nudges_sent || 0) + 1;
  session.data.last_nudge_sent_at = new Date().toISOString();
  await saveSession(session, { isNew: false });
  await supaPatch(`reengagement_queue?id=eq.${encodeURIComponent(queueId)}`, { status: "sent", actioned_at: new Date().toISOString(), actioned_by: email });

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, status: "sent" }));
};
