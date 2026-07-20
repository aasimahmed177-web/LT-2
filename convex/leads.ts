import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Parses Indian real-estate budget-range strings (crore/lakh notation) into an
// estimated INR value — e.g. "under_₹3cr_" -> 2.25cr, "₹3cr–₹5cr_" -> 4cr
// (midpoint). Best-effort only, used for CAPI Purchase value/currency, not
// billing or any financial calculation.
function parseBudgetRangeToINR(raw: string): number | undefined {
  if (!raw) return undefined;
  const normalized = raw.toLowerCase().replace(/_/g, " ");
  const tokenRegex = /(\d+(?:\.\d+)?)\s*(cr|crore|l|lakh|lac)\b/g;
  const toINR = (num: number, unit: string) => (unit.startsWith("cr") ? num * 1e7 : num * 1e5);
  const matches = [...normalized.matchAll(tokenRegex)];
  if (matches.length === 0) return undefined;
  const values = matches.map((m) => toINR(parseFloat(m[1]), m[2]));
  if (values.length === 1) {
    if (/\bunder\b|\bbelow\b/.test(normalized)) return values[0] * 0.75;
    if (/\+|\babove\b|\bover\b/.test(normalized)) return values[0] * 1.25;
    return values[0];
  }
  return (Math.min(...values) + Math.max(...values)) / 2;
}

function extractBudgetFieldValue(fieldData: { name: string; values: string[] }[]): string | undefined {
  for (const field of fieldData || []) {
    if ((field.name || "").toLowerCase().includes("budget")) return field.values?.[0];
  }
  return undefined;
}

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

    const budgetRaw = extractBudgetFieldValue(args.fieldData);
    const dealValueEstimate = budgetRaw ? parseBudgetRangeToINR(budgetRaw) : undefined;

    if (existing) {
      // Only update Meta-owned/source fields. Never overwrite CRM-owned fields.
      const patch: any = {
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
      };
      // Only set if we found a value this time — never wipe an existing
      // estimate (e.g. one set by a CSV import) just because a re-sync
      // didn't happen to include the budget field this round.
      if (dealValueEstimate !== undefined) {
        patch.dealValueEstimate = dealValueEstimate;
        patch.dealValueCurrency = "INR";
      }
      await ctx.db.patch(existing._id, patch);
      return { action: "updated", id: existing._id };
    }

    const insertDoc: any = {
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
    };
    if (dealValueEstimate !== undefined) {
      insertDoc.dealValueEstimate = dealValueEstimate;
      insertDoc.dealValueCurrency = "INR";
    }
    const id = await ctx.db.insert("leads", insertDoc);

    // Per Meta's Conversion Leads CRM integration docs, the raw/initial lead
    // stage should be reported too, not just later funnel stages — mirrors the
    // "Lead" entry in crm.ts's CAPI_STAGE_EVENT_MAP. Created here (at ingestion)
    // rather than in crm:updateStage, since there's no explicit stage-change
    // call for a lead's very first stage.
    const now = new Date().toISOString();
    const eventTime = Math.floor(Date.now() / 1000);
    await ctx.db.insert("conversionLeadEvents", {
      leadId: id,
      metaLeadId: args.metaLeadId,
      eventName: "Lead",
      stage: "Lead",
      status: "pending",
      createdAt: now,
      attempts: 0,
      clientId: args.clientId ? String(args.clientId) : undefined,
      eventId: `${args.metaLeadId}_Lead_${eventTime}`,
      action_source: "system_generated",
      eventTime,
    });

    return { action: "inserted", id };
  },
});

// Sets a lead's estimated deal value (e.g. parsed from a CSV budget column).
export const setDealValue = mutation({
  args: {
    leadId: v.id("leads"),
    dealValueEstimate: v.number(),
    dealValueCurrency: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      dealValueEstimate: args.dealValueEstimate,
      dealValueCurrency: args.dealValueCurrency,
    });
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