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

export const createTask = mutation({
  args: {
    leadId: v.id("leads"),
    title: v.string(),
    dueAt: v.optional(v.number()),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");
    const now = Date.now();
    return await ctx.db.insert("tasks", {
      workspaceId: lead.workspaceId,
      leadId: args.leadId,
      title: args.title,
      dueAt: args.dueAt,
      status: "pending",
      assignedTo: args.assignedTo,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listTasksForLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_leadId", (q: any) => q.eq("leadId", args.leadId))
      .order("desc")
      .collect();
  },
});

export const completeTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "done",
      updatedAt: now,
    });
  },
});