export default function handler(req: any, res: any) {
  const path = req.url || "/";

  if (req.method === "GET" && path.includes("health")) {
    res.status(200).json({ status: "ok", service: "pathfinder-backend" });
  } else if (req.method === "POST" && path.includes("webhook")) {
    const { From, Body } = req.body || {};

    if (!From || !Body) {
      res.status(400).json({ error: "Missing From or Body" });
    } else {
      res.status(200).json({ received: true });
    }
  } else if (req.method === "GET" && path.includes("stats")) {
    res.status(200).json({
      total_students: 0,
      completed_assessments: 0,
      qualified_leads: 0,
      colleges_connected: 0,
      leads_contacted: 0,
      leads_enrolled: 0,
    });
  } else {
    res.status(404).json({ error: "Not found" });
  }
}
