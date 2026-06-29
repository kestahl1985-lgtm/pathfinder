// Scheduled data-retention job (POPIA: don't keep PII longer than needed).
// Deletes whatsapp_sessions inactive for longer than RETENTION_DAYS.
// Triggered by Vercel Cron; protected by CRON_SECRET.
const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || "540", 10); // ~18 months

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
  const url = new URL(SUPABASE_URL);

  const result = await new Promise((resolve) => {
    const r = https.request(
      {
        hostname: url.hostname,
        path: `/rest/v1/whatsapp_sessions?updated_at=lt.${encodeURIComponent(cutoff)}`,
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

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, deleted: result.count || 0, cutoff }));
};
