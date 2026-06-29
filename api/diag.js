// Temporary diagnostic endpoint. Reveals the exact From the live function
// uses for WhatsApp sends and Twilio's real response. Remove after debugging.
const https = require("https");

module.exports = (req, res) => {
  const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
  const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
  const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

  const url = new URL(req.url, "http://x");
  const to = url.searchParams.get("to"); // e.g. ?to=+27719309590

  const fromUsed = `whatsapp:${PHONE_NUMBER}`;

  const respond = (obj) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(obj, null, 2));
  };

  if (!to) {
    return respond({
      phone_number_env: PHONE_NUMBER,
      from_that_would_be_used: fromUsed,
      note: "Pass ?to=+27...number... to attempt a real send and see Twilio's response.",
    });
  }

  const params = new URLSearchParams({
    From: fromUsed,
    To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    Body: "Pathfinder diagnostic send.",
  }).toString();

  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
  const r = https.request(
    {
      hostname: "api.twilio.com",
      path: `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
        "Content-Length": Buffer.byteLength(params),
      },
    },
    (tr) => {
      let data = "";
      tr.on("data", (c) => (data += c));
      tr.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        respond({
          phone_number_env: PHONE_NUMBER,
          from_used: fromUsed,
          to: to,
          twilio_http_status: tr.statusCode,
          twilio_response: parsed,
        });
      });
    }
  );
  r.on("error", (e) => respond({ from_used: fromUsed, request_error: e.message }));
  r.write(params);
  r.end();
};
