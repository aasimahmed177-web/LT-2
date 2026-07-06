import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEMO_WORKSPACE_SLUG = "ask-arun-dubai-real-estate";

async function getWorkspaceId(ctx: any) {
  const workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_slug", (q: any) => q.eq("slug", DEMO_WORKSPACE_SLUG))
    .first();
  if (!workspace) throw new Error("Workspace not found");
  return workspace._id;
}

export const createPendingEvent = mutation({
  args: {
    leadId: v.id("leads"),
    eventName: v.string(),
    stage: v.string(),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");
    const now = Date.now();
    const idempotencyKey = `${args.leadId}_${args.eventName}`;

    const existing = await ctx.db
      .query("conversionLeadEvents")
      .filter((q) =>
        q.and(
          q.eq(q.field("leadId"), args.leadId),
          q.eq(q.field("idempotencyKey"), idempotencyKey),
          q.neq(q.field("status"), "failed")
        )
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("conversionLeadEvents", {
      workspaceId: lead.workspaceId,
      leadId: args.leadId,
      metaLeadId: lead.metaLeadId,
      eventName: args.eventName,
      stage: args.stage,
      eventTime: now,
      status: "pending",
      attemptCount: 0,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listEventsForLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversionLeadEvents")
      .withIndex("by_leadId", (q: any) => q.eq("leadId", args.leadId))
      .order("desc")
      .collect();
  },
});

export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    const workspaceId = await getWorkspaceId(ctx);
    return await ctx.db
      .query("conversionLeadEvents")
      .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
      .order("desc")
      .collect();
  },
});

export const listFailedEvents = query({
  args: {},
  handler: async (ctx) => {
    const workspaceId = await getWorkspaceId(ctx);
    return await ctx.db
      .query("conversionLeadEvents")
      .filter((q) =>
        q.and(
          q.eq(q.field("workspaceId"), workspaceId),
          q.eq(q.field("status"), "failed")
        )
      )
      .order("desc")
      .collect();
  },
});

export const markEventSent = mutation({
  args: { eventId: v.id("conversionLeadEvents") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.eventId, {
      status: "sent",
      updatedAt: now,
    });
  },
});

export const markEventFailed = mutation({
  args: {
    eventId: v.id("conversionLeadEvents"),
    errorMessage: v.optional(v.string()),
    responsePayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    const now = Date.now();
    await ctx.db.patch(args.eventId, {
      status: "failed",
      errorMessage: args.errorMessage,
      responsePayload: args.responsePayload,
      attemptCount: event.attemptCount + 1,
      updatedAt: now,
    });
  },
});