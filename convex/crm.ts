import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ─── Stage Management ───────────────────────────────────────────────

const STAGE_EVENT_MAP: Record<string, string> = {
  ConversionLead: "conversion_lead",
  Purchase: "purchase",
};

export const updateStage = mutation({
  args: {
    leadId: v.id("leads"),
    stage: v.string(),
  },
  handler: async (ctx, { leadId, stage }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) throw new Error("Lead not found");

    const fromStage = lead.stage;
    const now = new Date().toISOString();

    await ctx.db.patch(leadId, { stage, stageChangedAt: now });

    await ctx.db.insert("leadStageHistory", {
      leadId,
      metaLeadId: lead.metaLeadId,
      fromStage,
      toStage: stage,
      changedAt: now,
    });

    const eventName = STAGE_EVENT_MAP[stage];
    if (eventName) {
      await ctx.db.insert("conversionLeadEvents", {
        leadId,
        metaLeadId: lead.metaLeadId,
        eventName,
        stage,
        status: "pending",
        createdAt: now,
        attempts: 0,
      });
    }
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
  },
  handler: async (ctx, { leadId, content }) => {
    const now = new Date().toISOString();
    const id = await ctx.db.insert("tasks", {
      leadId,
      content,
      done: false,
      createdAt: now,
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

export const eventsCounts = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("conversionLeadEvents").collect();
    return {
      pending: events.filter((e) => e.status === "pending").length,
      sent: events.filter((e) => e.status === "sent").length,
      failed: events.filter((e) => e.status === "failed").length,
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

    const total = all.length;
    const newToday = all.filter((l) => l.ingestedAt >= todayStart).length;
    const last24h = all.filter((l) => l.ingestedAt >= yesterdayStart).length;

    const byStage: Record<string, number> = {};
    for (const l of all) {
      byStage[l.stage] = (byStage[l.stage] || 0) + 1;
    }

    const stageOrder = ["new", "contacted", "prospect", "ConversionLead", "Purchase"];
    const funnel = stageOrder.map((stage) => ({
      stage,
      count: byStage[stage] || 0,
    }));

    const activityByDate: Record<string, number> = {};
    for (const l of all) {
      const date = l.ingestedAt?.substring(0, 10);
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