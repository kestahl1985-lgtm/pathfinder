import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET" && req.url === "/health") {
    return res.status(200).json({ status: "ok", service: "pathfinder-backend" });
  }

  if (req.method === "POST" && req.url === "/webhook") {
    const { From, Body } = req.body;

    if (!From || !Body) {
      return res.status(400).json({ error: "Missing From or Body" });
    }

    // TODO: Implement webhook handling with database integration
    return res.status(200).json({ received: true });
  }

  if (req.method === "GET" && req.url === "/api/stats") {
    // TODO: Implement stats fetching from database
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
}
