import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  clients: defineTable({
    name: v.string(),
    slug: v.string(),
    status: v.string(),
    createdAt: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  clientMetaConfigs: defineTable({
    clientId: v.id("clients"),
    pageId: v.optional(v.string()),
    accessTokenConfigured: v.boolean(),
    pixelId: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_clientId", ["clientId"]),

  leadForms: defineTable({
    clientId: v.id("clients"),
    formId: v.string(),
    formName: v.string(),
    status: v.string(),
    importedAt: v.string(),
  })
    .index("by_clientId", ["clientId"])
    .index("by_formId", ["formId"]),

  syncRuns: defineTable({
    clientId: v.id("clients"),
    startedAt: v.string(),
    finishedAt: v.optional(v.string()),
    status: v.string(),
    formsScanned: v.number(),
    leadsFetched: v.number(),
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
    total: v.number(),
    perForm: v.any(),
    error: v.optional(v.string()),
  })
    .index("by_clientId", ["clientId"])
    .index("by_status", ["status"]),

  leads: defineTable({
    clientId: v.optional(v.id("clients")),
    metaLeadId: v.string(),
    adId: v.optional(v.string()),
    adName: v.optional(v.string()),
    adSetId: v.optional(v.string()),
    adSetName: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    campaignName: v.optional(v.string()),
    platform: v.string(),
    fieldData: v.any(),
    fullResponse: v.any(),
    pageId: v.optional(v.string()),
    ingestedAt: v.string(),
    stage: v.string(),
    stageChangedAt: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    formName: v.optional(v.string()),
    formId: v.optional(v.string()),
  })
    .index("by_metaLeadId", ["metaLeadId"])
    .index("by_stage", ["stage"])
    .index("by_clientId", ["clientId"]),

  leadStageHistory: defineTable({
    leadId: v.id("leads"),
    metaLeadId: v.string(),
    fromStage: v.string(),
    toStage: v.string(),
    changedAt: v.string(),
    changedBy: v.optional(v.string()),
    reason: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"])
    .index("by_metaLeadId", ["metaLeadId"]),

  conversionLeadEvents: defineTable({
    leadId: v.id("leads"),
    metaLeadId: v.string(),
    eventName: v.string(),
    stage: v.string(),
    status: v.string(),
    createdAt: v.string(),
    attempts: v.number(),
    error: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"])
    .index("by_status", ["status"]),

  notes: defineTable({
    leadId: v.id("leads"),
    content: v.string(),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"]),

  tasks: defineTable({
    leadId: v.id("leads"),
    content: v.string(),
    done: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"]),

  importResults: defineTable({
    clientId: v.optional(v.id("clients")),
    data: v.any(),
    createdAt: v.string(),
  }),
});