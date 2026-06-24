import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("leads").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("leads") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const upsertMetaLead = mutation({
  args: {
    metaLeadId: v.string(),
    adId: v.optional(v.string()),
    adName: v.optional(v.string()),
    adSetId: v.optional(v.string()),
    adSetName: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    campaignName: v.optional(v.string()),
    pageId: v.optional(v.string()),
    fieldData: v.any(),
    fullResponse: v.any(),
    ingestedAt: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leads")
      .withIndex("by_metaLeadId", (q) => q.eq("metaLeadId", args.metaLeadId))
      .first();

    if (existing) {
      // Only update Meta-owned/source fields.
      // Never overwrite CRM-owned fields: stage, stageChangedAt, notes, tasks, history, conversionLeadEvents.
      await ctx.db.patch(existing._id, {
        adId: args.adId,
        adName: args.adName,
        adSetId: args.adSetId,
        adSetName: args.adSetName,
        campaignId: args.campaignId,
        campaignName: args.campaignName,
        pageId: args.pageId,
        fieldData: args.fieldData,
        fullResponse: args.fullResponse,
        ingestedAt: args.ingestedAt,
        name: args.name,
        email: args.email,
        phone: args.phone,
      });
      return { action: "updated", id: existing._id };
    } else {
      const id = await ctx.db.insert("leads", {
        metaLeadId: args.metaLeadId,
        adId: args.adId,
        adName: args.adName,
        adSetId: args.adSetId,
        adSetName: args.adSetName,
        campaignId: args.campaignId,
        campaignName: args.campaignName,
        pageId: args.pageId,
        fieldData: args.fieldData,
        fullResponse: args.fullResponse,
        ingestedAt: args.ingestedAt,
        stage: "Lead",
        platform: "meta",
        name: args.name,
        email: args.email,
        phone: args.phone,
      });
      return { action: "inserted", id };
    }
  },
});

export const counts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("leads").collect();
    return {
      total: all.length,
      byStage: all.reduce<Record<string, number>>((acc, lead) => {
        acc[lead.stage] = (acc[lead.stage] || 0) + 1;
        return acc;
      }, {}),
    };
  },
});