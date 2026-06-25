import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("leads").order("desc").collect();
  },
});

export const listByClientId = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("leads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByMetaLeadId = query({
  args: { metaLeadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_metaLeadId", (q) => q.eq("metaLeadId", args.metaLeadId))
      .first();
  },
});

export const counts = query({
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

export const countsByClientId = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("leads")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .collect();
    return {
      total: all.length,
      byStage: all.reduce<Record<string, number>>((acc, lead) => {
        acc[lead.stage] = (acc[lead.stage] || 0) + 1;
        return acc;
      }, {}),
    };
  },
});

// Upsert a lead by metaLeadId. Never overwrites CRM-owned fields (stage, notes, tasks, history, events).
export const upsertMetaLead = mutation({
  args: {
    clientId: v.optional(v.id("clients")),
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
    formName: v.optional(v.string()),
    formId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leads")
      .withIndex("by_metaLeadId", (q) => q.eq("metaLeadId", args.metaLeadId))
      .first();

    if (existing) {
      // Only update Meta-owned/source fields. Never overwrite CRM-owned fields.
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
        formName: args.formName,
        formId: args.formId,
        clientId: args.clientId || (existing as any).clientId,
      });
      return { action: "updated", id: existing._id };
    }

    const id = await ctx.db.insert("leads", {
      clientId: args.clientId,
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
      formName: args.formName,
      formId: args.formId,
    });
    return { action: "inserted", id };
  },
});

// Assign all leads without clientId to a client
export const assignToClient = mutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("leads").collect();
    let count = 0;
    for (const lead of all) {
      if (!(lead as any).clientId) {
        await ctx.db.patch(lead._id, { clientId: args.clientId } as any);
        count++;
      }
    }
    return { assigned: count };
  },
});