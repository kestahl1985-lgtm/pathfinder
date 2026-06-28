import express from "express";
import { handleWebhook } from "./handler.js";
import { getDashboardStats } from "./db.js";
import { parseWebhookMessage } from "./twilio.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "pathfinder-backend" });
});

app.post("/webhook", async (req, res) => {
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

app.get("/api/stats", async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.listen(PORT, () => {
  console.log(`Pathfinder backend running on port ${PORT}`);
});

export default app;
