// Admin-triggered outbound WhatsApp message.
// POST { phone, message } with Authorization: Bearer <supabase access token>
// from a logged-in admin session. Verifies the token, checks the caller is
// in admin_allowlist, confirms the phone belongs to a known learner
// (whatsapp_sessions), sends via the Meta Cloud API, and logs the attempt.
//
// Note: WhatsApp only allows free-form replies within 24h of the learner's
// last inbound message (the "session window"). Outside that window Meta
// returns error 131047 ("re-engagement" / >24h) and this endpoint surfaces
// that clearly rather than failing silently — to reach a learner outside the
// window you must use an approved template, not free-form text.

const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

const ALLOWED_ORIGINS = [
  "https://admin.vulacareers.co.za",
  "https://pathfinder-admin-pi.vercel.app",
];

function setCors(req, res) {
  const origin = req.headers.origin;
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Basic per-IP rate limit (defence in depth; primary control is admin auth).
const _rl = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const e = _rl.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { e.count = 0; e.start = now; }
  e.count += 1;
  _rl.set(ip, e);
  return e.count > 20; // max 20 sends/min per IP
}

function supaGet(path) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const req = https.request(
      { hostname: url.hostname, path: `/rest/v1/${path}`, method: "GET",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } }); }
    );
    req.on("error", () => resolve(null));
    req.end();
  });
}

function supaInsert(path, row) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const body = JSON.stringify([row]);
    const req = https.request(
      { hostname: url.hostname, path: `/rest/v1/${path}`, method: "POST",
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json", Prefer: "return=minimal",
          "Content-Length": Buffer.byteLength(body),
        } },
      (res) => { res.on("data", () => {}); res.on("end", () => resolve(res.statusCode)); }
    );
    req.on("error", () => resolve(0));
    req.write(body);
    req.end();
  });
}

// Verify the bearer token is a live Supabase session and return the user's email.
function verifyAdminToken(token) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const req = https.request(
      { hostname: url.hostname, path: "/auth/v1/user", method: "GET",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve(null);
          try { resolve(JSON.parse(d).email || null); } catch { resolve(null); }
        });
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

// Send free-form text via the Meta Cloud API. Meta wants the recipient as a
// bare number (digits only), not Twilio's "whatsapp:+…" address form.
function metaSend(to, body) {
  return new Promise((resolve) => {
    const wa = String(to).replace(/^whatsapp:/, "").replace(/[^\d]/g, "");
    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: wa,
      type: "text",
      text: { preview_url: false, body },
    });
    const req = https.request(
      { hostname: "graph.facebook.com", path: `/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
          "Content-Length": Buffer.byteLength(payload),
        } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          let parsed = {};
          try { parsed = JSON.parse(d); } catch {}
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
        });
      }
    );
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return; }

  if (!SUPABASE_URL || !SUPABASE_KEY || !META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    res.statusCode = 500; res.end(JSON.stringify({ error: "Not configured" })); return;
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) { res.statusCode = 429; res.end(JSON.stringify({ error: "Too many requests, slow down" })); return; }

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

  const phoneRaw = String(body.phone || "").trim();
  const message = String(body.message || "").trim();

  if (!phoneRaw || !message) { res.statusCode = 400; res.end(JSON.stringify({ error: "Phone and message are required" })); return; }
  if (message.length > 4096) { res.statusCode = 400; res.end(JSON.stringify({ error: "Message too long (max 4096 characters)" })); return; }

  const phone = phoneRaw.startsWith("whatsapp:") ? phoneRaw : `whatsapp:${phoneRaw}`;

  // Confirm the phone belongs to a known learner session — prevents using
  // this endpoint to message arbitrary numbers outside Vula's user base.
  const sessions = await supaGet(`whatsapp_sessions?phone=eq.${encodeURIComponent(phone)}&select=phone`);
  if (!Array.isArray(sessions) || sessions.length === 0) {
    res.statusCode = 404; res.end(JSON.stringify({ error: "No learner found with that phone number" })); return;
  }

  const result = await metaSend(phone, message);

  // Meta returns { messages: [{ id: "wamid..." }] } on success, or
  // { error: { message, code } } on failure. twilio_sid is reused to store the
  // provider message id (no schema change; it's just an external reference).
  const metaId = result.data && result.data.messages && result.data.messages[0] && result.data.messages[0].id;
  const metaErr = result.data && result.data.error && result.data.error.message;
  await supaInsert("admin_messages", {
    sent_by: email,
    to_phone: phone,
    body: message,
    status: result.ok ? "sent" : "failed",
    twilio_sid: metaId || null,
    error: result.ok ? null : metaErr || result.error || `HTTP ${result.status}`,
  });

  if (result.ok) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, sid: metaId || null }));
  } else {
    // Meta error 131047 means the 24h free-form window is closed — a template
    // is required to re-engage. Surface Meta's message rather than failing mute.
    res.statusCode = 502;
    res.end(JSON.stringify({ ok: false, error: metaErr || result.error || "Send failed" }));
  }
};
