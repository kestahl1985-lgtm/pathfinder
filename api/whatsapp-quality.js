// WhatsApp sender quality rating for the admin System page.
//
// The quality rating is a Meta concept (GREEN / YELLOW / RED). It is only
// fetchable via the Meta Graph API, which needs META_ACCESS_TOKEN +
// META_PHONE_NUMBER_ID — the same credentials the Meta Cloud API migration
// sets. Until that migration happens the number is on Twilio and these are not
// set, so this endpoint honestly reports "not configured" rather than inventing
// a rating. Once the Meta env vars exist, it returns the real rating with no
// further change. CORS-enabled so the admin can call it from the browser; the
// token stays server-side and is never returned.

const https = require("https");

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

function graphGet(path) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: "graph.facebook.com", path, method: "GET", headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve({ ok: res.statusCode < 300, json: d ? JSON.parse(d) : null }); }
          catch { resolve({ ok: false, json: null }); }
        });
      }
    );
    req.on("error", () => resolve({ ok: false, json: null }));
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    res.statusCode = 200;
    res.end(JSON.stringify({
      configured: false,
      provider: "twilio",
      reason: "The WhatsApp sender is on Twilio. The Meta quality rating activates after the Meta Cloud API migration; until then, check quality in the Twilio Console.",
    }));
    return;
  }

  const r = await graphGet(`/${GRAPH_VERSION}/${PHONE_NUMBER_ID}?fields=quality_rating,messaging_limit_tier,name_status,verified_name`);
  if (!r.ok || !r.json) {
    res.statusCode = 200;
    res.end(JSON.stringify({ configured: true, ok: false, reason: "Could not reach the Meta Graph API." }));
    return;
  }
  res.statusCode = 200;
  res.end(JSON.stringify({
    configured: true,
    ok: true,
    quality_rating: r.json.quality_rating || "UNKNOWN", // GREEN | YELLOW | RED
    messaging_limit_tier: r.json.messaging_limit_tier || null,
    name_status: r.json.name_status || null,
    verified_name: r.json.verified_name || null,
  }));
};
