import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";
import { resolveClientId } from "../clients.js";

const router = Router();

// CAPI: fire-and-forget send of the most recent pending event for a lead
async function triggerCapiAfterStageChange(leadId: string, convexLeadId: string) {
  try {
    // Find the most recent pending CAPI event for this lead
    const events: any[] = await getConvex().query("crm:listEventsByLead", { leadId: convexLeadId as any });
    const pendingEvent = events.find((e: any) => e.status === "pending" && e.eventId);
    if (!pendingEvent) return; // No CAPI event to send

    // Call the CAPI send endpoint internally
    const pixelId = process.env.META_PIXEL_ID;
    const isDryRun = process.env.META_CAPI_DRY_RUN !== "false";
    const metaToken = process.env.META_ACCESS_TOKEN;

    if (!pixelId || !metaToken) {
      // Mark as skipped if CAPI not configured
      console.log(`[CAPI] Skipping event ${pendingEvent.eventId}: CAPI not configured (pixel=${!!pixelId}, token=${!!metaToken})`);
      return;
    }

    // Send the event via the helper
    const url = `http://localhost:${process.env.PORT || "3001"}/api/meta/send-capi-event`;
    const capiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: pendingEvent._id }),
    });
    const capiData: any = await capiRes.json();
    if (capiData.success) {
      console.log(`[CAPI] Event ${pendingEvent.eventName} sent for lead ${leadId}: ${capiData.status}`);
    } else {
      console.log(`[CAPI] Event ${pendingEvent.eventName} failed for lead ${leadId}: ${capiData.error}`);
    }
  } catch (err: any) {
    // Never let CAPI failure bubble up
    console.error("[CAPI] Async send error:", err.message);
  }
}

// GET /api/leads
router.get("/", async (req: Request, res: Response) => {
  try {
    const clientId = resolveClientId(req.query.clientId as string);
    const leads = await getConvex().query("leads:list");
    const enriched = (leads as any[]).map((l: any) => ({ ...l, clientId }));
    res.json({ leads: enriched, clientId });
  } catch (err: any) {
    console.error("Leads list error:", err.message);
    res.status(500).json({ error: "Failed to fetch leads", detail: err.message });
  }
});

// GET /api/leads/enriched
router.get("/enriched", async (req: Request, res: Response) => {
  try {
    const clientId = resolveClientId(req.query.clientId as string);
    const leads = await getConvex().query("leads:list");
    const enriched = await Promise.all(
      (leads as any[]).map(async (lead: any) => {
        const [notes, tasks, history] = await Promise.allSettled([
          getConvex().query("crm:listNotes", { leadId: lead._id }),
          getConvex().query("crm:listTasks", { leadId: lead._id }),
          getConvex().query("crm:listStageHistory", { leadId: lead._id }),
        ]);
        return {
          ...lead,
          clientId,
          notes: notes.status === "fulfilled" ? notes.value : [],
          tasks: tasks.status === "fulfilled" ? tasks.value : [],
          history: history.status === "fulfilled" ? history.value : [],
        };
      })
    );
    res.json({ leads: enriched, clientId });
  } catch (err: any) {
    console.error("Leads enriched error:", err.message);
    res.status(500).json({ error: "Failed to fetch enriched leads", detail: err.message });
  }
});

// GET /api/leads/search
router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").toLowerCase();
    const clientId = resolveClientId(req.query.clientId as string);
    const leads = await getConvex().query("leads:list");
    const filtered = (leads as any[]).filter(
      (l: any) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.toLowerCase().includes(q)) ||
        (l.metaLeadId && l.metaLeadId.toLowerCase().includes(q))
    );
    res.json({ leads: filtered, clientId });
  } catch (err: any) {
    console.error("Leads search error:", err.message);
    res.status(500).json({ error: "Failed to search leads", detail: err.message });
  }
});

// GET /api/debug/source-of-truth
router.get("/source-of-truth", async (_req: Request, res: Response) => {
  try {
    const leads = await getConvex().query("leads:list");
    const counts = await getConvex().query("leads:counts");
    res.json({ totalLeads: leads.length, byStage: counts.byStage, clientId: resolveClientId(_req.query.clientId as string) });
  } catch (err: any) {
    console.error("Source of truth error:", err.message);
    res.status(500).json({ error: "Failed to fetch source of truth", detail: err.message });
  }
});

// GET /api/leads/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const lead = await getConvex().query("leads:getById", { id: req.params.id });
    if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
    res.json({ ...lead, clientId: resolveClientId(req.query.clientId as string) });
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
    const lead = await getConvex().query("leads:getById", { id: req.params.id });
    if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

    const convexLeadId = req.params.id;
    const clientId = resolveClientId(req.query.clientId as string);

    await getConvex().mutation("crm:updateStage", {
      leadId: convexLeadId as any,
      stage,
      reason: reason || undefined,
      clientId,
    });

    // Fire-and-forget CAPI send (non-blocking, stage change always succeeds)
    triggerCapiAfterStageChange(lead.metaLeadId || convexLeadId, convexLeadId).catch((e) => {
      console.error("[CAPI] Background send error:", e.message);
    });

    res.json({ success: true, stage });
  } catch (err: any) {
    console.error("Stage change error:", err.message);
    res.status(500).json({ error: "Failed to update stage", detail: err.message });
  }
});

// GET /api/leads/:id/history
router.get("/:id/history", async (req: Request, res: Response) => {
  try {
    const history = await getConvex().query("crm:listStageHistory", { leadId: req.params.id });
    res.json({ history });
  } catch (err: any) {
    console.error("History error:", err.message);
    res.status(500).json({ error: "Failed to fetch history", detail: err.message });
  }
});

// GET /api/leads/:id/events
router.get("/:id/events", async (req: Request, res: Response) => {
  try {
    // Use the deployed listEvents query (returns all events) and filter by leadId server-side
    const allEvents: any[] = await getConvex().query("crm:listEvents");
    const events = allEvents.filter((e: any) => String(e.leadId) === req.params.id);
    res.json({ events });
  } catch (err: any) {
    console.error("Events list error:", err.message);
    // Gracefully degrade to empty events if the Convex function is unavailable
    res.json({ events: [] });
  }
});

// GET /api/leads/:id/notes
router.get("/:id/notes", async (req: Request, res: Response) => {
  try {
    const notes = await getConvex().query("crm:listNotes", { leadId: req.params.id });
    res.json({ notes });
  } catch (err: any) {
    console.error("Notes error:", err.message);
    res.status(500).json({ error: "Failed to fetch notes", detail: err.message });
  }
});

// POST /api/leads/:id/notes
router.post("/:id/notes", async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const noteResult: any = await getConvex().mutation("crm:addNote", { leadId: req.params.id, content });
    res.json({ id: noteResult.id });
  } catch (err: any) {
    console.error("Note create error:", err.message);
    res.status(500).json({ error: "Failed to create note", detail: err.message });
  }
});

// GET /api/leads/:id/tasks
router.get("/:id/tasks", async (req: Request, res: Response) => {
  try {
    const tasks = await getConvex().query("crm:listTasks", { leadId: req.params.id });
    res.json({ tasks });
  } catch (err: any) {
    console.error("Tasks error:", err.message);
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
    console.error("Task create error:", err.message);
    res.status(500).json({ error: "Failed to create task", detail: err.message });
  }
});

// PATCH /api/leads/:id/tasks/:taskId
router.patch("/:id/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const { done } = req.body;
    await getConvex().mutation("crm:toggleTask", { taskId: req.params.taskId, done });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Task toggle error:", err.message);
    res.status(500).json({ error: "Failed to toggle task", detail: err.message });
  }
});

export default router;