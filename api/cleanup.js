// Scheduled data-retention job (POPIA: don't keep PII longer than needed).
// Deletes whatsapp_sessions inactive for longer than RETENTION_DAYS, plus
// matching rows in sponsor_matches and reengagement_queue — both key off a
// learner's phone number, so without this they'd keep it (and, for
// sponsor_matches, a RIASEC profile snapshot) past the same retention
// window this job exists to enforce.
// Triggered by Vercel Cron; protected by CRON_SECRET.
const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || "540", 10); // ~18 months

function deleteOlderThan(hostname, path) {
  return new Promise((resolve) => {
    const r = https.request(
      {
        hostname,
        path,
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=representation",
          "Content-Type": "application/json",
        },
      },
      (resp) => {
        let d = "";
        resp.on("data", (c) => (d += c));
        resp.on("end", () => {
          let count = 0;
          try { count = JSON.parse(d).length; } catch {}
          resolve({ status: resp.statusCode, count });
        });
      }
    );
    r.on("error", (e) => resolve({ status: 0, error: e.message }));
    r.end();
  });
}

module.exports = async (req, res) => {
  // Only allow Vercel Cron (or callers with the secret)
  const secret = process.env.CRON_SECRET;
  const auth = req.headers["authorization"] || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Supabase not configured" }));
    return;
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
  const hostname = new URL(SUPABASE_URL).hostname;
  const enc = encodeURIComponent(cutoff);

  const [sessions, sponsorMatches, reengagementQueue] = await Promise.all([
    deleteOlderThan(hostname, `/rest/v1/whatsapp_sessions?updated_at=lt.${enc}`),
    deleteOlderThan(hostname, `/rest/v1/sponsor_matches?created_at=lt.${enc}`),
    deleteOlderThan(hostname, `/rest/v1/reengagement_queue?queued_at=lt.${enc}`),
  ]);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({
    ok: true,
    cutoff,
    deleted: {
      whatsapp_sessions: sessions.count || 0,
      sponsor_matches: sponsorMatches.count || 0,
      reengagement_queue: reengagementQueue.count || 0,
    },
  }));
};
