// Public health/liveness endpoint. CORS-enabled so the admin's System page can
// ping it from the browser as a real API-layer check (there is no sensitive
// data here — just liveness + a server timestamp for latency measurement).
module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "ok", service: "pathfinder-backend", time: new Date().toISOString() }));
};
