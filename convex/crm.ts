import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ─── Stage Management ───────────────────────────────────────────────

// Stage hierarchy for final-stage-only suppression.
// Higher number = higher priority. Purchase > ConversionLead > Prospect > Contact > Lead.
export const STAGE_HIERARCHY: Record<string, number> = {
  Lead: 0,
  Contact: 1,
  Prospect: 2,
  ConversionLead: 3,
  Purchase: 4,
};

// CAPI send mode: "final_stage_only" suppresses lower-stage events when a higher-stage one exists.
// Set to "all" to disable suppression and send every positive stage change.
const CAPI_SEND_MODE = "final_stage_only";

// Maps CRM stages to CAPI event names, in ascending funnel order.
// Stages not in this map (NotQualified, NoResponse, etc.) never generate CAPI events.
//
// Per Meta's Conversion Leads CRM integration docs, the "raw lead" stage should
// be sent too ("send all stages as they are updated, including the raw lead"),
// so "Lead" has its own entry here (created at ingestion time in
// leads:upsertMetaLead, not here in updateStage). "ConversionLead" is mapped to
// a distinct custom event name rather than reusing "Lead" again, since it fires
// much later in the funnel and Meta's own examples use "Lead" specifically for
// the initial stage.
const CAPI_STAGE_EVENT_MAP: Record<string, string> = {
  Lead: "Lead",
  Contact: "Contact",
  Prospect: "QualifiedLead",
  ConversionLead: "ConversionLead",
  Purchase: "Purchase",
};

// Also keep the legacy CRM event mapping for internal tracking
const CRM_EVENT_MAP: Record<string, string> = {
  ConversionLead: "conversion_lead",
  Purchase: "purchase",
};

// Helper: highest stage score among active events (sent/pending) for a list of events
function getHighestStageScore(events: any[]): number {
  let highest = -1;
  for (const e of events) {
    if (e.status === "sent" || e.status === "pending") {
      const score = STAGE_HIERARCHY[e.stage] ?? -1;
      if (score > highest) highest = score;
    }
  }
  return highest;
}

export const updateStage = mutation({
  args: {
    leadId: v.id("leads"),
    stage: v.string(),
    reason: v.optional(v.string()),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, { leadId, stage, reason, clientId }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) throw new Error("Lead not found");

    // Don't create duplicate if same stage clicked twice
    if (lead.stage === stage) return { success: true, unchanged: true };

    const fromStage = lead.stage;
    const now = new Date().toISOString();

    await ctx.db.patch(leadId, { stage, stageChangedAt: now });

    await ctx.db.insert("leadStageHistory", {
      leadId,
      metaLeadId: lead.metaLeadId,
      fromStage,
      toStage: stage,
      changedAt: now,
      reason: reason || undefined,
    });

    // Create CAPI event(s) for positive stage changes
    const capiEventName = CAPI_STAGE_EVENT_MAP[stage];
    let capiEventsCreated = 0;
    if (capiEventName) {
      const newStageScore = STAGE_HIERARCHY[stage] ?? -1;

      // Check existing events for this lead
      const existingEvents = await ctx.db
        .query("conversionLeadEvents")
        .withIndex("by_leadId", (q) => q.eq("leadId", leadId))
        .collect();

      const highestStageScore = getHighestStageScore(existingEvents);

      if (CAPI_SEND_MODE === "final_stage_only" && highestStageScore > newStageScore) {
        // Backward move (e.g. correcting a mistaken stage) — a higher-stage
        // event already exists, so just record this one as suppressed rather
        // than backfilling a ladder that would contradict what was already sent.
        const eventTime = Math.floor(Date.now() / 1000);
        await ctx.db.insert("conversionLeadEvents", {
          leadId,
          metaLeadId: lead.metaLeadId,
          eventName: capiEventName,
          stage,
          status: "suppressed",
          createdAt: now,
          attempts: 0,
          clientId: clientId || undefined,
          eventId: `${lead.metaLeadId}_${stage}_${eventTime}`,
          action_source: "system_generated",
          eventTime,
        });
        return { success: true, capiEventCreated: true, suppressed: true, reason: `Higher-stage event already exists` };
      }

      // Forward move: per Meta's Conversion Leads guidance, every funnel rung
      // should be reported — if the CRM jumps straight from Lead to
      // ConversionLead (skipping Contact/Prospect), backfill CAPI events for
      // every unfilled rung up to and including the new stage, not just the
      // new stage alone. Rungs that already have an event (any status) are
      // never recreated.
      const stagesWithEvent = new Set(existingEvents.map((e: any) => e.stage));
      const rungs = Object.keys(CAPI_STAGE_EVENT_MAP)
        .filter((s) => {
          const score = STAGE_HIERARCHY[s] ?? -1;
          return score >= 0 && score <= newStageScore && !stagesWithEvent.has(s);
        })
        .sort((a, b) => (STAGE_HIERARCHY[a] ?? -1) - (STAGE_HIERARCHY[b] ?? -1));

      // Stagger the backfilled rungs one second apart, ending at "now", so the
      // funnel progression Meta receives is unambiguously ordered. Writing the
      // whole ladder with an identical event_time (they're all inserted within
      // the same second) leaves Meta unable to tell that Lead preceded Contact
      // preceded QualifiedLead. Counting backwards keeps the newest stage at
      // the real current time and never stamps an event in the future.
      const nowSec = Math.floor(Date.now() / 1000);
      for (let r = 0; r < rungs.length; r++) {
        const rung = rungs[r];
        const rungEventTime = nowSec - (rungs.length - 1 - r);
        await ctx.db.insert("conversionLeadEvents", {
          leadId,
          metaLeadId: lead.metaLeadId,
          eventName: CAPI_STAGE_EVENT_MAP[rung],
          stage: rung,
          status: "pending",
          createdAt: now,
          attempts: 0,
          clientId: clientId || undefined,
          eventId: `${lead.metaLeadId}_${rung}_${rungEventTime}`,
          action_source: "system_generated",
          eventTime: rungEventTime,
        });
        capiEventsCreated++;
      }
    }

    // Also create legacy CRM event for ConversionLead and Purchase
    const legacyEventName = CRM_EVENT_MAP[stage];
    if (legacyEventName && !capiEventName) {
      await ctx.db.insert("conversionLeadEvents", {
        leadId,
        metaLeadId: lead.metaLeadId,
        eventName: legacyEventName,
        stage,
        status: "pending",
        createdAt: now,
        attempts: 0,
      });
    }

    return { success: true, capiEventCreated: capiEventsCreated > 0, capiEventsCreated };
  },
});

// ─── Notes ──────────────────────────────────────────────────────────

export const listNotes = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    return await ctx.db
      .query("notes")
      .withIndex("by_leadId", (q) => q.eq("leadId", leadId))
      .order("desc")
      .collect();
  },
});

export const addNote = mutation({
  args: {
    leadId: v.id("leads"),
    content: v.string(),
  },
  handler: async (ctx, { leadId, content }) => {
    const now = new Date().toISOString();
    const id = await ctx.db.insert("notes", {
      leadId,
      content,
      createdAt: now,
    });
    return { id };
  },
});

// ─── Tasks ──────────────────────────────────────────────────────────

export const listTasks = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_leadId", (q) => q.eq("leadId", leadId))
      .order("desc")
      .collect();
  },
});

export const addTask = mutation({
  args: {
    leadId: v.id("leads"),
    content: v.string(),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, { leadId, content, dueDate }) => {
    const now = new Date().toISOString();
    const id = await ctx.db.insert("tasks", {
      leadId,
      content,
      done: false,
      createdAt: now,
      dueDate: dueDate || undefined,
    });
    return { id };
  },
});

export const toggleTask = mutation({
  args: {
    taskId: v.id("tasks"),
    done: v.boolean(),
  },
  handler: async (ctx, { taskId, done }) => {
    const now = new Date().toISOString();
    await ctx.db.patch(taskId, { done, updatedAt: now });
  },
});

// ─── Stage History ──────────────────────────────────────────────────

export const listStageHistory = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    return await ctx.db
      .query("leadStageHistory")
      .withIndex("by_leadId", (q) => q.eq("leadId", leadId))
      .order("desc")
      .collect();
  },
});

// ─── CRM Events ─────────────────────────────────────────────────────

export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("conversionLeadEvents").order("desc").collect();
    const leadIds = [...new Set(events.map((e) => e.leadId))];
    const leads = await Promise.all(leadIds.map((id) => ctx.db.get(id)));
    const leadMap = Object.fromEntries(
      leads.filter(Boolean).map((l) => [l!._id, l])
    );

    return events.map((e) => ({
      ...e,
      leadName: leadMap[e.leadId]?.name ?? null,
    }));
  },
});

// Used by the failed-event retry scheduled function — indexed lookup rather
// than filtering listEvents() client-side.
export const listEventsByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, { status }) => {
    return await ctx.db
      .query("conversionLeadEvents")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect();
  },
});

// Re-queues events that were recorded but never transmitted (i.e. "skipped"
// because CAPI was in dry-run) back to "pending" so they can actually be sent
// once META_CAPI_DRY_RUN=false. Without this, importing while in dry-run would
// be a one-way door: skipped events are blocked from sending forever.
export const requeueSkippedEvents = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const skipped = await ctx.db
      .query("conversionLeadEvents")
      .withIndex("by_status", (q) => q.eq("status", "skipped"))
      .collect();
    const batch = typeof limit === "number" ? skipped.slice(0, limit) : skipped;
    const now = new Date().toISOString();
    for (const e of batch) {
      await ctx.db.patch(e._id, { status: "pending", updatedAt: now, error: undefined });
    }
    return { requeued: batch.length, remaining: skipped.length - batch.length };
  },
});

export const getCapiEventByEventId = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const events = await ctx.db
      .query("conversionLeadEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .collect();
    return events[0] || null;
  },
});

export const updateCapiEventStatus = mutation({
  args: {
    eventId: v.id("conversionLeadEvents"),
    status: v.string(),
    error: v.optional(v.string()),
    response: v.optional(v.string()),
    attempts: v.optional(v.number()),
    payloadSent: v.optional(v.string()),
  },
  handler: async (ctx, { eventId, status, error, response, attempts, payloadSent }) => {
    const now = new Date().toISOString();
    const patch: any = { status, lastAttemptAt: now, updatedAt: now };
    if (error !== undefined) patch.error = error;
    if (response !== undefined) patch.response = response;
    if (attempts !== undefined) patch.attempts = attempts;
    if (payloadSent !== undefined) patch.payloadSent = payloadSent;
    await ctx.db.patch(eventId, patch);
  },
});

export const getCapiEventById = query({
  args: { id: v.id("conversionLeadEvents") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const listEventsByLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    return await ctx.db
      .query("conversionLeadEvents")
      .withIndex("by_leadId", (q) => q.eq("leadId", leadId))
      .order("desc")
      .collect();
  },
});

export const eventsCounts = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("conversionLeadEvents").collect();
    return {
      pending: events.filter((e) => e.status === "pending").length,
      sent: events.filter((e) => e.status === "sent").length,
      failed: events.filter((e) => e.status === "failed").length,
      skipped: events.filter((e) => e.status === "skipped").length,
dry_run: events.filter((e) => e.status === "dry_run").length,
      cancelled: events.filter((e) => e.status === "cancelled").length,
      suppressed: events.filter((e) => e.status === "suppressed").length,
      total: events.length,
    };
  },
});

// ─── Stats ──────────────────────────────────────────────────────────

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("leads").collect();
    const notes = await ctx.db.query("notes").collect();
    const tasks = await ctx.db.query("tasks").collect();
    const events = await ctx.db.query("conversionLeadEvents").collect();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterdayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    function getLeadCreatedDate(l: typeof all[number]): string {
      return (l.fullResponse as any)?.created_time || l.ingestedAt;
    }

    const total = all.length;
    const newToday = all.filter((l) => getLeadCreatedDate(l) >= todayStart).length;
    const last24h = all.filter((l) => getLeadCreatedDate(l) >= yesterdayStart).length;

    const byStage: Record<string, number> = {};
    for (const l of all) {
      byStage[l.stage] = (byStage[l.stage] || 0) + 1;
    }

    const stageOrder = ["Lead", "Contact", "Prospect", "ConversionLead", "Purchase"];
    const funnel = stageOrder.map((stage) => ({
      stage,
      count: byStage[stage] || 0,
    }));

    const activityByDate: Record<string, number> = {};
    for (const l of all) {
      const date = getLeadCreatedDate(l).substring(0, 10);
      if (date) activityByDate[date] = (activityByDate[date] || 0) + 1;
    }

    return {
      total,
      newToday,
      last24h,
      byStage,
      funnel,
      activityByDate,
      contacted: byStage["contacted"] || 0,
      prospects: byStage["prospect"] || 0,
      conversionLeads: byStage["ConversionLead"] || 0,
      purchases: byStage["Purchase"] || 0,
      notQualified: byStage["NotQualified"] || 0,
      noResponse: byStage["NoResponse"] || 0,
      duplicate: byStage["Duplicate"] || 0,
      invalid: byStage["Invalid"] || 0,
      pendingCrmEvents: events.filter((e) => e.status === "pending").length,
      totalNotes: notes.length,
      totalTasks: tasks.length,
    };
  },
});