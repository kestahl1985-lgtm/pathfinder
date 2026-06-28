module.exports = (req, res) => {
  const path = req.url || "/";

  try {
    if (req.method === "GET" && path.includes("health")) {
      res.setHeader("Content-Type", "application/json");
      res.status(200).end(JSON.stringify({ status: "ok", service: "pathfinder-backend" }));
      return;
    }

    if (req.method === "POST" && path.includes("webhook")) {
      const { From, Body } = req.body || {};
      res.setHeader("Content-Type", "application/json");
      if (!From || !Body) {
        res.status(400).end(JSON.stringify({ error: "Missing From or Body" }));
      } else {
        res.status(200).end(JSON.stringify({ received: true }));
      }
      return;
    }

    if (req.method === "GET" && path.includes("stats")) {
      res.setHeader("Content-Type", "application/json");
      res.status(200).end(JSON.stringify({
        total_students: 0,
        completed_assessments: 0,
        qualified_leads: 0,
        colleges_connected: 0,
        leads_contacted: 0,
        leads_enrolled: 0,
      }));
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.status(404).end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    console.error("Error:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).end(JSON.stringify({ error: "Server error" }));
  }
};
