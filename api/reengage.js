// Re-engagement queueing — scheduled job (Vercel Cron, daily, protected by
// CRON_SECRET, same pattern as api/cleanup.js).
//
// A learner who finished the assessment goes quiet forever unless nudged.
// This job does NOT send anything itself — it only decides who's *due* for
// a nudge and adds them to the `reengagement_queue` table, which backs the
// admin "Re-engagement Schedule" screen. An admin reviews the queue and
// triggers the actual send manually (api/reengage-action.js) — kept manual
// deliberately (not auto-sent) since re-opening a conversation outside
// WhatsApp's 24h free-form window requires a pre-approved Message Template
// (see WHATSAPP_PRODUCTION.md's `grade_progress_nudge` — needs Meta
// Business Manager approval before any send, automatic or manual, will
// actually deliver), and because proactive outreach is worth a human
// glancing at who's being messaged rather than firing blind.
//
// Eligibility (grade-independent — the onboarding flow no longer collects
// grade, so this can't key off grade-year progression the way an earlier
// version of this file did):
//   - report_token is set (assessment completed)
//   - fewer than MAX_NUDGES already sent
//   - due: first nudge ~10 months after data.report_completed_at; each
//     subsequent nudge ~10 months after the last one sent. This is just a
//     "check back in periodically" cadence now, not tied to any specific
//     academic milestone.

const https = require("https");
const { loadSession } = require("../lib/assessment.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_NUDGES = 2; // avoid pestering a learner forever; adjust if needed

const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_KEY);

function nextDueDate(fromIso) {
  const d = new Date(fromIso);
  const due = new Date(d);
  due.setUTCMonth(due.getUTCMonth() + 10);
  return due;
}

function isDue(session) {
  const data = session.data || {};
  if (!data.report_completed_at) return false; // pre-dates this feature, can't time it safely

  const nudgesSent = data.nudges_sent || 0;
  if (nudgesSent >= MAX_NUDGES) return false;

  const now = new Date();
  if (nudgesSent === 0) return now >= nextDueDate(data.report_completed_at);

  return now >= nextDueDate(data.last_nudge_sent_at);
}

function supa(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
    if (method === "POST") headers["Prefer"] = "return=minimal";
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
    const req = https.request({ hostname: url.hostname, path: `/rest/v1/${path}`, method, headers }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve({ ok: res.statusCode < 300, json: d ? JSON.parse(d) : null }); } catch { resolve({ ok: res.statusCode < 300, json: null }); } });
    });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

// Fetches candidate phones broadly (assessment completed); the precise
// due-date/nudge-count check happens in JS per session via isDue(). Fine at
// Vula's current scale — move to DB-side filtering if the session table
// grows large enough for this to matter.
async function fetchCandidatePhones() {
  const r = await supa("GET", "whatsapp_sessions?report_token=not.is.null&select=phone");
  return r.ok && Array.isArray(r.json) ? r.json.map((row) => row.phone) : [];
}

// True if this phone already has a pending queue entry — avoids re-queueing
// the same learner every day between when they're first queued and when an
// admin actually sends (or skips) it.
async function alreadyQueued(phone) {
  const r = await supa("GET", `reengagement_queue?phone=eq.${encodeURIComponent(phone)}&status=eq.pending&select=id&limit=1`);
  return r.ok && Array.isArray(r.json) && r.json.length > 0;
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers["authorization"] || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  if (!hasSupabase()) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Supabase not configured" }));
    return;
  }

  const phones = await fetchCandidatePhones();
  let queued = 0, skipped = 0;

  for (const phone of phones) {
    const session = await loadSession(phone);
    if (!session || !isDue(session)) { skipped += 1; continue; }
    if (await alreadyQueued(phone)) { skipped += 1; continue; }

    const r = await supa("POST", "reengagement_queue", { phone, status: "pending" });
    if (r.ok) queued += 1; else skipped += 1;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, candidates: phones.length, queued, skipped }));
};

// Exposed for testing (harmless extra properties on the handler function —
// same pattern as webhook-meta.js's module.exports.config).
module.exports.nextDueDate = nextDueDate;
module.exports.isDue = isDue;
