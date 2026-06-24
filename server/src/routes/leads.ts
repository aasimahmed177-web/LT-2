import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";

const router = Router();

// GET /api/leads - list all
router.get("/", async (_req: Request, res: Response) => {
  try {
    const leads = await getConvex().query("leads:list");
    res.json({ leads });
  } catch (err: any) {
    console.error("Leads list error:", err.message);
    res.status(500).json({ error: "Failed to fetch leads", detail: err.message });
  }
});

// GET /api/leads/search?q=xxx
router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").toLowerCase().trim();
    const leads = await getConvex().query("leads:list");
    if (!q) {
      res.json({ leads });
      return;
    }
    const filtered = (leads as any[]).filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.toLowerCase().includes(q)) ||
        (l.metaLeadId && l.metaLeadId.toLowerCase().includes(q))
    );
    res.json({ leads: filtered });
  } catch (err: any) {
    console.error("Leads search error:", err.message);
    res.status(500).json({ error: "Search failed", detail: err.message });
  }
});

// GET /api/debug/source-of-truth (must be before /:id)
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
      leads: (leads as any[]).map((l: any) => ({
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

// GET /api/leads/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const lead = await getConvex().query("leads:getById", { id: req.params.id as any });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json(lead);
  } catch (err: any) {
    console.error("Lead get error:", err.message);
    res.status(500).json({ error: "Failed to fetch lead", detail: err.message });
  }
});

// PUT /api/leads/:id/stage
router.put("/:id/stage", async (req: Request, res: Response) => {
  try {
    const { stage, reason } = req.body;
    if (!stage) {
      res.status(400).json({ error: "stage is required" });
      return;
    }
    await getConvex().mutation("crm:updateStage", {
      leadId: req.params.id as any,
      stage,
      reason: reason || undefined,
    });
    res.json({ success: true, stage });
  } catch (err: any) {
    console.error("Stage update error:", err.message);
    res.status(500).json({ error: "Failed to update stage", detail: err.message });
  }
});

// GET /api/leads/:id/history
router.get("/:id/history", async (req: Request, res: Response) => {
  try {
    const history = await getConvex().query("crm:listStageHistory", {
      leadId: req.params.id as any,
    });
    res.json({ history });
  } catch (err: any) {
    console.error("History error:", err.message);
    res.status(500).json({ error: "Failed to fetch history", detail: err.message });
  }
});

// GET /api/leads/:id/events
router.get("/:id/events", async (req: Request, res: Response) => {
  try {
    const events = await getConvex().query("crm:listEventsByLead", {
      leadId: req.params.id as any,
    });
    res.json({ events });
  } catch (err: any) {
    console.error("Events list error:", err.message);
    res.status(500).json({ error: "Failed to fetch events", detail: err.message });
  }
});

// GET /api/leads/:id/notes
router.get("/:id/notes", async (req: Request, res: Response) => {
  try {
    const notes = await getConvex().query("crm:listNotes", {
      leadId: req.params.id as any,
    });
    res.json({ notes });
  } catch (err: any) {
    console.error("Notes list error:", err.message);
    res.status(500).json({ error: "Failed to fetch notes", detail: err.message });
  }
});

// POST /api/leads/:id/notes
router.post("/:id/notes", async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const result = await getConvex().mutation("crm:addNote", {
      leadId: req.params.id as any,
      content,
    });
    res.json(result);
  } catch (err: any) {
    console.error("Note add error:", err.message);
    res.status(500).json({ error: "Failed to add note", detail: err.message });
  }
});

// GET /api/leads/:id/tasks
router.get("/:id/tasks", async (req: Request, res: Response) => {
  try {
    const tasks = await getConvex().query("crm:listTasks", {
      leadId: req.params.id as any,
    });
    res.json({ tasks });
  } catch (err: any) {
    console.error("Tasks list error:", err.message);
    res.status(500).json({ error: "Failed to fetch tasks", detail: err.message });
  }
});

// POST /api/leads/:id/tasks
router.post("/:id/tasks", async (req: Request, res: Response) => {
  try {
    const { content, dueDate } = req.body;
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const result = await getConvex().mutation("crm:addTask", {
      leadId: req.params.id as any,
      content,
      dueDate: dueDate || undefined,
    });
    res.json(result);
  } catch (err: any) {
    console.error("Task add error:", err.message);
    res.status(500).json({ error: "Failed to add task", detail: err.message });
  }
});

// PATCH /api/leads/:id/tasks/:taskId
router.patch("/:id/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const { done } = req.body;
    if (typeof done !== "boolean") {
      res.status(400).json({ error: "done (boolean) is required" });
      return;
    }
    await getConvex().mutation("crm:toggleTask", {
      taskId: req.params.taskId as any,
      done,
    });
    res.json({ success: true, done });
  } catch (err: any) {
    console.error("Task toggle error:", err.message);
    res.status(500).json({ error: "Failed to toggle task", detail: err.message });
  }
});

export default router;