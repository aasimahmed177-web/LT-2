import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";
import { resolveClientId } from "../clients.js";

const router = Router();

// GET /api/stats - dashboard stats
router.get("/", async (req: Request, res: Response) => {
  try {
    const clientId = resolveClientId(req.query.clientId as string);
    const stats = await getConvex().query("crm:getStats");
    res.json({ ...stats, clientId });
  } catch (err: any) {
    console.error("Stats error:", err.message);
    res.status(500).json({ error: "Failed to fetch stats", detail: err.message });
  }
});

export default router;