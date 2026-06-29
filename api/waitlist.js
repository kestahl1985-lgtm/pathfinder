// Waitlist signup endpoint. Stores name + contact in Supabase `waitlist`.
// CORS-enabled for the marketing site. Service-role key stays server-side.
const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://vula-web.vercel.app",
  "https://vulacareers.co.za",
  "https://www.vulacareers.co.za",
];

function setCors(req, res) {
  const origin = req.headers.origin;
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Simple per-IP rate limit (in-memory; per warm instance — basic abuse brake).
const _rl = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const e = _rl.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { e.count = 0; e.start = now; }
  e.count += 1;
  _rl.set(ip, e);
  return e.count > 6; // max 6 signups/min per IP
}

// A contact should look like a phone number or an email.
function validContact(c) {
  return /\d{6,}/.test(c.replace(/\s/g, "")) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c);
}

module.exports = async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  res.setHeader("Content-Type", "application/json");

  // Rate limit per IP
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) { res.statusCode = 429; res.end(JSON.stringify({ error: "Too many requests" })); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Honeypot: real users never fill this hidden field. Bots do → silently accept.
  if (String(body.website || "").trim()) { res.statusCode = 200; res.end(JSON.stringify({ ok: true })); return; }

  const name = String(body.name || "").trim().slice(0, 80);
  const contact = String(body.contact || "").trim().slice(0, 80);

  if (!name || !contact) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Name and contact are required" }));
    return;
  }
  if (!validContact(contact)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Please enter a valid phone number or email" }));
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Not configured" }));
    return;
  }

  const payload = JSON.stringify([
    { name, contact, source: "website", created_at: new Date().toISOString() },
  ]);
  const url = new URL(SUPABASE_URL);

  const result = await new Promise((resolve) => {
    const r = https.request(
      {
        hostname: url.hostname,
        path: "/rest/v1/waitlist",
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (resp) => { let d = ""; resp.on("data", (c) => (d += c)); resp.on("end", () => resolve({ status: resp.statusCode, d })); }
    );
    r.on("error", (e) => resolve({ status: 0, error: e.message }));
    r.write(payload);
    r.end();
  });

  if (result.status >= 200 && result.status < 300) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "Could not save signup" }));
  }
};
