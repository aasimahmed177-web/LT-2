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
  })
    .index("by_metaLeadId", ["metaLeadId"])
    .index("by_stage", ["stage"]),
});