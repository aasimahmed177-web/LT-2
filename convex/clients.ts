import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─────────── Clients CRUD ───────────

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("clients").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clients")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const listActive = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("clients")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string(), slug: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clients")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error(`Client "${args.slug}" already exists`);
    return await ctx.db.insert("clients", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

export const updateName = mutation({
  args: { id: v.id("clients"), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name });
  },
});

// ─────────── Meta Config ───────────

export const getMetaConfig = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clientMetaConfigs")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .first();
  },
});

export const upsertMetaConfig = mutation({
  args: {
    clientId: v.id("clients"),
    pageId: v.optional(v.string()),
    accessTokenConfigured: v.boolean(),
    pixelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clientMetaConfigs")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        pageId: args.pageId,
        accessTokenConfigured: args.accessTokenConfigured,
        pixelId: args.pixelId,
      });
      return existing._id;
    }
    return await ctx.db.insert("clientMetaConfigs", {
      clientId: args.clientId,
      pageId: args.pageId,
      accessTokenConfigured: args.accessTokenConfigured,
      pixelId: args.pixelId,
      createdAt: new Date().toISOString(),
    });
  },
});

// ─────────── Lead Forms ───────────

export const listLeadForms = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leadForms")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .collect();
  },
});

export const setLeadForms = mutation({
  args: {
    clientId: v.id("clients"),
    forms: v.array(
      v.object({
        formId: v.string(),
        formName: v.string(),
        status: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leadForms")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .collect();
    for (const f of existing) {
      await ctx.db.delete(f._id);
    }
    const now = new Date().toISOString();
    for (const f of args.forms) {
      await ctx.db.insert("leadForms", {
        clientId: args.clientId,
        formId: f.formId,
        formName: f.formName,
        status: f.status,
        importedAt: now,
      });
    }
  },
});

// ─────────── Sync Runs ───────────

export const listSyncRuns = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("syncRuns")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .collect();
  },
});

export const getLastSyncRun = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("syncRuns")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .first();
  },
});

export const createSyncRun = mutation({
  args: { clientId: v.id("clients"), formsScanned: v.number(), leadsFetched: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("syncRuns", {
      clientId: args.clientId,
      startedAt: new Date().toISOString(),
      finishedAt: undefined,
      status: "running",
      formsScanned: args.formsScanned,
      leadsFetched: args.leadsFetched,
      created: 0,
      updated: 0,
      skipped: 0,
      total: 0,
      perForm: [],
    });
  },
});

export const completeSyncRun = mutation({
  args: {
    syncRunId: v.id("syncRuns"),
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
    total: v.number(),
    perForm: v.any(),
    formsScanned: v.optional(v.number()),
    leadsFetched: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.syncRunId, {
      finishedAt: new Date().toISOString(),
      status: "completed",
      created: args.created,
      updated: args.updated,
      skipped: args.skipped,
      total: args.total,
      perForm: args.perForm,
      formsScanned: args.formsScanned,
      leadsFetched: args.leadsFetched,
    });
  },
});

export const failSyncRun = mutation({
  args: { syncRunId: v.id("syncRuns"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.syncRunId, {
      finishedAt: new Date().toISOString(),
      status: "failed",
      error: args.error,
    });
  },
});