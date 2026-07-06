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

export const listStages = query({
  args: {},
  handler: async (ctx) => {
    const workspaceId = await getWorkspaceId(ctx);
    return await ctx.db
      .query("crmStages")
      .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
      .order("asc")
      .collect();
  },
});

export const updateStageConfig = mutation({
  args: {
    stageId: v.id("crmStages"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("other"), v.literal("positive"), v.literal("negative"))),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { stageId, ...fields } = args;
    const patch: Record<string, any> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.type !== undefined) patch.type = fields.type;
    if (fields.order !== undefined) patch.order = fields.order;
    await ctx.db.patch(stageId, patch);
  },
});