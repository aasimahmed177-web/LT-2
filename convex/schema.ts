import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leads: defineTable({
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
    .index("by_stage", ["stage"]),

  leadStageHistory: defineTable({
    leadId: v.id("leads"),
    metaLeadId: v.string(),
    fromStage: v.string(),
    toStage: v.string(),
    changedAt: v.string(),
    changedBy: v.optional(v.string()),
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
  })
    .index("by_leadId", ["leadId"]),

  importResults: defineTable({
    data: v.any(),
    createdAt: v.string(),
  }),
});