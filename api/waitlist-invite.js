// Admin-triggered action: invite a waitlist contact onto Vula via WhatsApp,
// sent directly from the admin dashboard (no redirect to WhatsApp).
// POST { waitlistId } with Authorization: Bearer <supabase access token>.
//
// Waitlist contacts have never messaged the Vula number, so — unlike
// api/send-message.js — this can't send free-form text (WhatsApp Business
// policy only allows a pre-approved *template* message for genuine first
// contact; see api/reengage-action.js's header for the same constraint on
// the re-engagement side). This sends the static "welcome_optin" template
// via the Meta Cloud API. That template must be created and approved in
// Meta Business Manager before this can actually deliver anything (see
// WHATSAPP_PRODUCTION.md) — until then this fails cleanly with the Meta
// error surfaced to the admin, not a silent no-op.

const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

const ALLOWED_ORIGINS = ["https://admin.vulacareers.co.za", "https://pathfinder-admin-pi.vercel.app"];

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
  return e.count > 20;
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

// Waitlist `contact` can be a phone or an email (see api/waitlist.js's
// validContact) — only phones can receive a WhatsApp template.
function isLikelyPhone(contact) {
  return /\d{6,}/.test(contact.replace(/\s/g, ""));
}

function toE164(contact) {
  let digits = contact.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("0")) digits = "27" + digits.slice(1); // assume SA local format
  return digits;
}

function sendWelcomeTemplate(phoneE164) {
  return new Promise((resolve) => {
    const payload = {
      messaging_product: "whatsapp",
      to: phoneE164,
      type: "template",
      template: { name: "welcome_optin", language: { code: "en_US" } },
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

  const waitlistId = String(body.waitlistId || "").trim();
  if (!waitlistId) { res.statusCode = 400; res.end(JSON.stringify({ error: "waitlistId is required" })); return; }

  const rows = await supaGet(`waitlist?id=eq.${encodeURIComponent(waitlistId)}&select=*&limit=1`);
  const entry = Array.isArray(rows) && rows[0];
  if (!entry) { res.statusCode = 404; res.end(JSON.stringify({ error: "No waitlist entry with that id" })); return; }

  if (!isLikelyPhone(entry.contact)) {
    res.statusCode = 400; res.end(JSON.stringify({ error: "This contact is an email, not a phone — can't send a WhatsApp invite" })); return;
  }

  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    res.statusCode = 500; res.end(JSON.stringify({ error: "Meta WhatsApp credentials not configured yet" })); return;
  }

  const result = await sendWelcomeTemplate(toE164(entry.contact));
  if (!result.ok) {
    // Likely means welcome_optin isn't approved in Meta Business Manager yet.
    const msg = (result.data && result.data.error && result.data.error.message) || result.error || `HTTP ${result.status}`;
    res.statusCode = 502; res.end(JSON.stringify({ ok: false, error: msg }));
    return;
  }

  await supaPatch(`waitlist?id=eq.${encodeURIComponent(waitlistId)}`, {
    invited_at: new Date().toISOString(),
    invited_by: email,
  });

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true }));
};
