import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";
import { resolveClientId } from "../clients.js";

const router = Router();

// GET /api/events - list CRM events
router.get("/", async (req: Request, res: Response) => {
  try {
    const clientId = resolveClientId(req.query.clientId as string);
    const events = await getConvex().query("crm:listEvents");
    res.json({ events: (events as any[]).map((e: any) => ({ ...e, clientId })), clientId });
  } catch (err: any) {
    console.error("Events list error:", err.message);
    res.status(500).json({ error: "Failed to fetch events", detail: err.message });
  }
});

// GET /api/events/counts - event summary
router.get("/counts", async (req: Request, res: Response) => {
  try {
    const clientId = resolveClientId(req.query.clientId as string);
    const counts = await getConvex().query("crm:eventsCounts");
    res.json({ ...counts, clientId });
  } catch (err: any) {
    console.error("Events counts error:", err.message);
    res.status(500).json({ error: "Failed to fetch event counts", detail: err.message });
  }
});

export default router;