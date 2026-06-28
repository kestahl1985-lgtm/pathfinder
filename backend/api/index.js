export default (req, res) => {
  const path = req.url || "/";

  try {
    if (req.method === "GET" && path.includes("health")) {
      return res.status(200).json({ status: "ok", service: "pathfinder-backend" });
    }

    if (req.method === "POST" && path.includes("webhook")) {
      const { From, Body } = req.body || {};
      if (!From || !Body) {
        return res.status(400).json({ error: "Missing From or Body" });
      }
      return res.status(200).json({ received: true });
    }

    if (req.method === "GET" && path.includes("stats")) {
      return res.status(200).json({
        total_students: 0,
        completed_assessments: 0,
        qualified_leads: 0,
        colleges_connected: 0,
        leads_contacted: 0,
        leads_enrolled: 0,
      });
    }

    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};
