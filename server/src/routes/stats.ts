import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";

const router = Router();

// GET /api/stats - dashboard stats
router.get("/", async (_req: Request, res: Response) => {
  try {
    const stats = await getConvex().query("crm:getStats");
    res.json(stats);
  } catch (err: any) {
    console.error("Stats error:", err.message);
    res.status(500).json({ error: "Failed to fetch stats", detail: err.message });
  }
});

export default router;