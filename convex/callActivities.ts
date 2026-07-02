import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store / upsert call activity for a lead ────────────────────────

export const storeCallActivity = mutation({
  args: {
    leadId: v.string(),
    metaLeadId: v.string(),
    callPicked: v.optional(v.string()),
    interested: v.optional(v.string()),
    meetingScheduled: v.optional(v.string()),
    purchase: v.optional(v.string()),
    callComments: v.optional(v.string()),
    caller: v.optional(v.string()),
    adName: v.optional(v.string()),
    lastCallDate: v.optional(v.string()),
    importBatchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    // Check if a call activity already exists for this metaLeadId
    const existing = await ctx.db
      .query("callActivities")
      .withIndex("by_metaLeadId", (q) => q.eq("metaLeadId", args.metaLeadId))
      .first();

    if (existing) {
      // Patch existing record — only overwrite provided fields
      const patch: any = { importedAt: now };
      if (args.callPicked !== undefined) patch.callPicked = args.callPicked;
      if (args.interested !== undefined) patch.interested = args.interested;
      if (args.meetingScheduled !== undefined) patch.meetingScheduled = args.meetingScheduled;
      if (args.purchase !== undefined) patch.purchase = args.purchase;
      if (args.callComments !== undefined) patch.callComments = args.callComments;
      if (args.caller !== undefined) patch.caller = args.caller;
      if (args.adName !== undefined) patch.adName = args.adName;
      if (args.lastCallDate !== undefined) patch.lastCallDate = args.lastCallDate;
      if (args.importBatchId !== undefined) patch.importBatchId = args.importBatchId;
      await ctx.db.patch(existing._id, patch);
      return { action: "updated", id: existing._id };
    }

    const id = await ctx.db.insert("callActivities", {
      leadId: args.leadId,
      metaLeadId: args.metaLeadId,
      callPicked: args.callPicked,
      interested: args.interested,
      meetingScheduled: args.meetingScheduled,
      purchase: args.purchase,
      callComments: args.callComments,
      caller: args.caller,
      adName: args.adName,
      lastCallDate: args.lastCallDate,
      importedAt: now,
      importBatchId: args.importBatchId,
    });
    return { action: "inserted", id };
  },
});

// ─── List all call activities ───────────────────────────────────────

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("callActivities").order("desc").collect();
  },
});

// ─── Get a single call activity by metaLeadId ───────────────────────

export const getByMetaLeadId = query({
  args: { metaLeadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("callActivities")
      .withIndex("by_metaLeadId", (q) => q.eq("metaLeadId", args.metaLeadId))
      .first();
  },
});

// ─── Get call activities for a list of metaLeadIds ──────────────────

export const getByMetaLeadIds = query({
  args: { metaLeadIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const results: any[] = [];
    for (const metaLeadId of args.metaLeadIds) {
      const activity = await ctx.db
        .query("callActivities")
        .withIndex("by_metaLeadId", (q) => q.eq("metaLeadId", metaLeadId))
        .first();
      if (activity) results.push(activity);
    }
    return results;
  },
});