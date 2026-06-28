module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      status: "ok",
      service: "pathfinder-backend",
      // Diagnostic: shows whether each env var is present (true/false only —
      // never exposes the actual values). Helps confirm Vercel config.
      env: {
        TWILIO_ACCOUNT_SID: Boolean(process.env.TWILIO_ACCOUNT_SID),
        TWILIO_AUTH_TOKEN: Boolean(process.env.TWILIO_AUTH_TOKEN),
        TWILIO_PHONE_NUMBER: Boolean(process.env.TWILIO_PHONE_NUMBER),
        SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    })
  );
};
