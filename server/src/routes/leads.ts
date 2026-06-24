import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";

const router = Router();

// GET /api/leads
router.get("/", async (_req: Request, res: Response) => {
  try {
    const leads = await getConvex().query("leads:list");
    res.json({ leads });
  } catch (err: any) {
    console.error("Leads list error:", err.message);
    res.status(500).json({ error: "Failed to fetch leads", detail: err.message });
  }
});

// GET /api/debug/source-of-truth
router.get("/source-of-truth", async (_req: Request, res: Response) => {
  try {
    const [leads, counts] = await Promise.all([
      getConvex().query("leads:list"),
      getConvex().query("leads:counts"),
    ]);
    res.json({
      timestamp: new Date().toISOString(),
      totalLeads: counts.total,
      byStage: counts.byStage,
      leads: leads.map((l: any) => ({
        id: l._id,
        metaLeadId: l.metaLeadId,
        name: l.name,
        email: l.email,
        stage: l.stage,
        campaignName: l.campaignName,
        ingestedAt: l.ingestedAt,
        platform: l.platform,
      })),
    });
  } catch (err: any) {
    console.error("Source of truth error:", err.message);
    res.status(500).json({ error: "Source of truth unavailable", detail: err.message });
  }
});

export default router;