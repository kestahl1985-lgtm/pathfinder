import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { handleWebhook } from "../src/handler.js";
import { getDashboardStats } from "../src/db.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: VercelRequest, res: VercelResponse) => {
  res.json({ status: "ok", service: "pathfinder-backend" });
});

app.post("/webhook", async (req: VercelRequest, res: VercelResponse) => {
  try {
    const { From, Body } = req.body;

    if (!From || !Body) {
      return res.status(400).json({ error: "Missing From or Body" });
    }

    await handleWebhook(From, Body);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/stats", async (_req: VercelRequest, res: VercelResponse) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default app;
