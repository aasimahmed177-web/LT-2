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
    platform: v.optional(v.string()),
    fieldData: v.optional(v.any()),
    fullResponse: v.optional(v.any()),
    pageId: v.optional(v.string()),
    ingestedAt: v.optional(v.string()),
    stage: v.optional(v.string()),
    stageChangedAt: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    formName: v.optional(v.string()),
    formId: v.optional(v.string()),
    // Legacy fields from old demo data
    adsetName: v.optional(v.string()),
    answers: v.optional(v.any()),
    createdAt: v.optional(v.number()),
    currentStage: v.optional(v.string()),
    fullName: v.optional(v.string()),
    lastEventSent: v.optional(v.string()),
    lastEventSentAt: v.optional(v.number()),
    leadStatus: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    rawPayload: v.optional(v.any()),
    syncStatus: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    workspaceId: v.optional(v.string()),
  })
    .index("by_metaLeadId", ["metaLeadId"])
    .index("by_stage", ["stage"])
    .index("by_clientId", ["clientId"]),

  leadStageHistory: defineTable({
    leadId: v.id("leads"),
    metaLeadId: v.optional(v.string()),
    fromStage: v.string(),
    toStage: v.string(),
    changedAt: v.optional(v.union(v.string(), v.number())),
    changedBy: v.optional(v.string()),
    reason: v.optional(v.string()),
    // Legacy field from old events.ts
    createdAt: v.optional(v.number()),
    workspaceId: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"])
    .index("by_metaLeadId", ["metaLeadId"]),

  conversionLeadEvents: defineTable({
    leadId: v.id("leads"),
    metaLeadId: v.string(),
    eventName: v.string(),
    stage: v.string(),
    status: v.string(),
    createdAt: v.union(v.string(), v.number()),
    attempts: v.optional(v.number()),
    error: v.optional(v.string()),
    clientId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    lastAttemptAt: v.optional(v.string()),
    response: v.optional(v.string()),
    action_source: v.optional(v.string()),
    eventTime: v.optional(v.number()),
    updatedAt: v.optional(v.union(v.string(), v.number())),
    // Legacy fields from old events.ts (may be present in existing documents)
    attemptCount: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"])
    .index("by_status", ["status"])
    .index("by_eventId", ["eventId"]),

  notes: defineTable({
    leadId: v.id("leads"),
    content: v.string(),
    createdAt: v.union(v.string(), v.number()),
    updatedAt: v.optional(v.union(v.string(), v.number())),
    // Legacy field
    workspaceId: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"]),

  tasks: defineTable({
    leadId: v.id("leads"),
    content: v.string(),
    done: v.boolean(),
    createdAt: v.union(v.string(), v.number()),
    updatedAt: v.optional(v.union(v.string(), v.number())),
    dueDate: v.optional(v.string()),
    // Legacy fields
    workspaceId: v.optional(v.string()),
    title: v.optional(v.string()),
    status: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    assignedTo: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"]),

  importResults: defineTable({
    clientId: v.optional(v.id("clients")),
    data: v.any(),
    createdAt: v.union(v.string(), v.number()),
  }),

  callActivities: defineTable({
    leadId: v.union(v.id("leads"), v.string()),
    metaLeadId: v.string(),
    callPicked: v.optional(v.string()),
    interested: v.optional(v.string()),
    meetingScheduled: v.optional(v.string()),
    purchase: v.optional(v.string()),
    callComments: v.optional(v.string()),
    caller: v.optional(v.string()),
    adName: v.optional(v.string()),
    lastCallDate: v.optional(v.string()),
    importedAt: v.optional(v.union(v.string(), v.number())),
    importBatchId: v.optional(v.string()),
  })
    .index("by_metaLeadId", ["metaLeadId"])
    .index("by_leadId", ["leadId"]),
});