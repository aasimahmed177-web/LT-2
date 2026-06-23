import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"]),

  leads: defineTable({
    workspaceId: v.id("workspaces"),
    metaLeadId: v.optional(v.string()),
    pageId: v.optional(v.string()),
    formId: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    campaignName: v.optional(v.string()),
    adsetId: v.optional(v.string()),
    adsetName: v.optional(v.string()),
    adId: v.optional(v.string()),
    adName: v.optional(v.string()),
    formName: v.optional(v.string()),
    createdTime: v.optional(v.string()),
    fullName: v.string(),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    answers: v.optional(v.any()),
    rawPayload: v.optional(v.any()),
    currentStage: v.string(),
    ownerId: v.optional(v.string()),
    leadStatus: v.optional(v.string()),
    syncStatus: v.optional(v.string()),
    lastEventSent: v.optional(v.string()),
    lastEventSentAt: v.optional(v.number()),
    lastMetaResponse: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_metaLeadId", ["metaLeadId"])
    .index("by_workspace_stage", ["workspaceId", "currentStage"])
    .index("by_workspace_created", ["workspaceId", "createdTime"])
    .index("by_phoneNumber", ["phoneNumber"]),

  crmStages: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    key: v.string(),
    order: v.number(),
    type: v.union(v.literal("other"), v.literal("positive"), v.literal("negative")),
  }),

  leadStageHistory: defineTable({
    workspaceId: v.id("workspaces"),
    leadId: v.id("leads"),
    fromStage: v.optional(v.string()),
    toStage: v.string(),
    changedBy: v.optional(v.string()),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_leadId", ["leadId"]),

  conversionLeadEvents: defineTable({
    workspaceId: v.id("workspaces"),
    leadId: v.id("leads"),
    metaLeadId: v.optional(v.string()),
    eventName: v.string(),
    stage: v.string(),
    eventTime: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    requestPayload: v.optional(v.any()),
    responsePayload: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    attemptCount: v.number(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_leadId", ["leadId"]),

  notes: defineTable({
    workspaceId: v.id("workspaces"),
    leadId: v.id("leads"),
    body: v.string(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_leadId", ["leadId"]),

  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    leadId: v.id("leads"),
    title: v.string(),
    dueAt: v.optional(v.number()),
    status: v.string(),
    assignedTo: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_leadId", ["leadId"]),
});