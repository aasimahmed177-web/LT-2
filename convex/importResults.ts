import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const record = mutation({
  args: {
    data: v.any(),
  },
  handler: async (ctx, { data }) => {
    const now = new Date().toISOString();

    // Keep only the most recent result — delete old ones first, then insert
    const existing = await ctx.db.query("importResults").collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    await ctx.db.insert("importResults", {
      data,
      createdAt: now,
    });

    return { success: true };
  },
});

export const getLast = query({
  args: {},
  handler: async (ctx) => {
    const results = await ctx.db.query("importResults").order("desc").take(1);
    if (results.length === 0) return null;
    const r = results[0];
    return {
      ...r.data,
      lastSyncedAt: r.createdAt,
    };
  },
});