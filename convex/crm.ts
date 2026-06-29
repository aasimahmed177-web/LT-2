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

// Maps CRM stages to CAPI event names.
// Stages not in this map (Lead, NotQualified, etc.) do not generate CAPI events.
const CAPI_STAGE_EVENT_MAP: Record<string, string> = {
  Contact: "Contact",
  Prospect: "QualifiedLead",
  ConversionLead: "Lead",
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

    // Create CAPI event for positive stage changes
    const capiEventName = CAPI_STAGE_EVENT_MAP[stage];
    if (capiEventName) {
      const eventTime = Math.floor(Date.now() / 1000);
      const eventId = `${lead.metaLeadId}_${stage}_${eventTime}`;
      const newStageScore = STAGE_HIERARCHY[stage] ?? -1;

      // Check existing events for this lead
      const existingEvents = await ctx.db
        .query("conversionLeadEvents")
        .withIndex("by_leadId", (q) => q.eq("leadId", leadId))
        .collect();

      if (CAPI_SEND_MODE === "final_stage_only") {
        const highestStageScore = getHighestStageScore(existingEvents);

        // If a higher-stage event already exists (sent or pending), suppress this one
        if (highestStageScore > newStageScore) {
          await ctx.db.insert("conversionLeadEvents", {
            leadId,
            metaLeadId: lead.metaLeadId,
            eventName: capiEventName,
            stage,
            status: "suppressed",
            createdAt: now,
            attempts: 0,
            clientId: clientId || undefined,
            eventId,
            action_source: "system_generated",
            eventTime,
          });
          return { success: true, capiEventCreated: true, suppressed: true, reason: `Higher-stage event already exists` };
        }

        // Suppress any lower-stage pending events (this new stage supersedes them)
        for (const existing of existingEvents) {
          const existingScore = STAGE_HIERARCHY[existing.stage] ?? -1;
          if (existing.status === "pending" && existingScore < newStageScore) {
            await ctx.db.patch(existing._id, {
              status: "suppressed",
              updatedAt: now,
            });
          }
        }
      }

      await ctx.db.insert("conversionLeadEvents", {
        leadId,
        metaLeadId: lead.metaLeadId,
        eventName: capiEventName,
        stage,
        status: "pending",
        createdAt: now,
        attempts: 0,
        clientId: clientId || undefined,
        eventId,
        action_source: "system_generated",
        eventTime,
      });
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

    return { success: true, capiEventCreated: !!capiEventName };
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
  },
  handler: async (ctx, { eventId, status, error, response, attempts }) => {
    const now = new Date().toISOString();
    const patch: any = { status, lastAttemptAt: now, updatedAt: now };
    if (error !== undefined) patch.error = error;
    if (response !== undefined) patch.response = response;
    if (attempts !== undefined) patch.attempts = attempts;
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