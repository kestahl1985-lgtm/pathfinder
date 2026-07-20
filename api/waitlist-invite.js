// Admin-triggered action: invite a waitlist contact onto Vula via WhatsApp,
// sent directly from the admin dashboard (no redirect to WhatsApp).
// POST { waitlistId } with Authorization: Bearer <supabase access token>.
//
// Waitlist contacts have never messaged the Vula number, so — unlike
// api/send-message.js — this can't send free-form text. WhatsApp only
// allows a pre-approved *template* message for business-initiated first
// contact (a platform rule, independent of the messaging provider). We send
// via Twilio's Content API (the same provider and auth the bot already uses
// for its button templates in api/webhook.js), using an approved "welcome"
// Content template identified by CONTENT_SID_WELCOME.
//
// SETUP REQUIRED before this delivers anything: create a WhatsApp "welcome"
// Content template in the Twilio Console, submit it for WhatsApp approval,
// then set CONTENT_SID_WELCOME (the HX... SID) in the backend's Vercel env.
// Until that's set this fails cleanly with a clear message to the admin,
// not a silent no-op. (When Meta business verification is done later, this
// can move to the Meta Cloud API like api/reengage-action.js — but Twilio
// keeps it working now on the existing, already-configured account.)

const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const CONTENT_SID_WELCOME = process.env.CONTENT_SID_WELCOME;

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

// Normalize to E.164 with leading + for Twilio's whatsapp: address.
function toWhatsAppAddr(contact) {
  let digits = contact.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) { /* already E.164 */ }
  else if (digits.startsWith("0")) digits = "+27" + digits.slice(1); // SA local
  else if (digits.startsWith("27")) digits = "+" + digits;
  else digits = "+" + digits;
  return `whatsapp:${digits}`;
}

// Send the approved welcome Content template via Twilio.
function sendWelcomeTemplate(toAddr) {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      From: `whatsapp:${PHONE_NUMBER}`,
      To: toAddr,
      ContentSid: CONTENT_SID_WELCOME,
    });
    const body = params.toString();
    const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
    const req = https.request(
      { hostname: "api.twilio.com", path: `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${auth}`, "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => { let parsed = {}; try { parsed = JSON.parse(d); } catch {} resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed }); });
      }
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

  if (!ACCOUNT_SID || !AUTH_TOKEN || !PHONE_NUMBER) {
    res.statusCode = 500; res.end(JSON.stringify({ error: "Twilio not configured" })); return;
  }
  if (!CONTENT_SID_WELCOME) {
    res.statusCode = 500; res.end(JSON.stringify({ error: "No welcome template configured yet — create an approved WhatsApp welcome template in Twilio and set CONTENT_SID_WELCOME. See api/waitlist-invite.js." })); return;
  }

  const result = await sendWelcomeTemplate(toWhatsAppAddr(entry.contact));
  if (!result.ok) {
    // Likely the template isn't approved yet, or the number can't receive WhatsApp.
    const msg = (result.data && result.data.message) || result.error || `HTTP ${result.status}`;
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
