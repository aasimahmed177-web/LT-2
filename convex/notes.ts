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

export const addNote = mutation({
  args: {
    leadId: v.id("leads"),
    body: v.string(),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");
    const now = Date.now();
    return await ctx.db.insert("notes", {
      workspaceId: lead.workspaceId,
      leadId: args.leadId,
      body: args.body,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listNotesForLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notes")
      .withIndex("by_leadId", (q: any) => q.eq("leadId", args.leadId))
      .order("desc")
      .collect();
  },
});