import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

const DEMO_WORKSPACE_SLUG = "ask-arun-dubai-real-estate";

async function getWorkspaceId(ctx: any) {
  const workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_slug", (q: any) => q.eq("slug", DEMO_WORKSPACE_SLUG))
    .first();
  if (!workspace) throw new Error("Workspace not found");
  return workspace._id;
}

export const listLeads = query({
  args: {
    search: v.optional(v.string()),
    stage: v.optional(v.string()),
    campaign: v.optional(v.string()),
    budget: v.optional(v.string()),
    syncStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspaceId = await getWorkspaceId(ctx);
    let leads = await ctx.db
      .query("leads")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .collect();

    if (args.stage) {
      leads = leads.filter((l) => l.currentStage === args.stage);
    }
    if (args.campaign) {
      leads = leads.filter((l) => l.campaignName === args.campaign);
    }
    if (args.syncStatus) {
      leads = leads.filter((l) => l.syncStatus === args.syncStatus);
    }
    if (args.search) {
      const q = args.search.toLowerCase();
      leads = leads.filter(
        (l) =>
          l.fullName.toLowerCase().includes(q) ||
          l.phoneNumber?.toLowerCase().includes(q) ||
          l.metaLeadId?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q)
      );
    }

    leads.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return leads;
  },
});

export const getLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");
    return lead;
  },
});

export const updateLeadStage = mutation({
  args: {
    leadId: v.id("leads"),
    stage: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    const fromStage = lead.currentStage;
    const now = Date.now();

    await ctx.db.patch(args.leadId, {
      currentStage: args.stage,
      updatedAt: now,
    });

    // Record stage history
    await ctx.db.insert("leadStageHistory", {
      workspaceId: lead.workspaceId,
      leadId: args.leadId,
      fromStage,
      toStage: args.stage,
      reason: args.reason,
      createdAt: now,
    });

    // Create pending conversionLeadEvents for positive/other stages that trigger Meta events
    const eventTriggerStages = ["Contact", "Prospect", "ConversionLead", "Purchase"];
    if (eventTriggerStages.includes(args.stage)) {
      const eventName = args.stage === "Contact" ? "Contact"
        : args.stage === "Prospect" ? "Prospect"
        : args.stage === "ConversionLead" ? "ConversionLead"
        : "Purchase";

      const idempotencyKey = `${args.leadId}_${eventName}`;

      // Prevent duplicate pending events for same lead + eventName
      const existing = await ctx.db
        .query("conversionLeadEvents")
        .filter((q) =>
          q.and(
            q.eq(q.field("leadId"), args.leadId),
            q.eq(q.field("idempotencyKey"), idempotencyKey),
            q.neq(q.field("status"), "failed")
          )
        )
        .first();

      if (!existing) {
        await ctx.db.insert("conversionLeadEvents", {
          workspaceId: lead.workspaceId,
          leadId: args.leadId,
          metaLeadId: lead.metaLeadId,
          eventName,
          stage: args.stage,
          eventTime: now,
          status: "pending",
          attemptCount: 0,
          idempotencyKey,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

export const updateLeadDetails = mutation({
  args: {
    leadId: v.id("leads"),
    fullName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    ownerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { leadId, ...fields } = args;
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (fields.fullName !== undefined) patch.fullName = fields.fullName;
    if (fields.phoneNumber !== undefined) patch.phoneNumber = fields.phoneNumber;
    if (fields.email !== undefined) patch.email = fields.email;
    if (fields.ownerId !== undefined) patch.ownerId = fields.ownerId;
    await ctx.db.patch(leadId, patch);
  },
});

export const seedDemoLeads = mutation({
  args: {},
  handler: async (ctx) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q: any) => q.eq("slug", DEMO_WORKSPACE_SLUG))
      .first();
    if (!workspace) throw new Error("Run seedDemoWorkspace first");
    const wid = workspace._id;
    const now = Date.now();

    const demoLeads = [
      {
        metaLeadId: "123456789012345",
        fullName: "Magesh Kumar",
        phoneNumber: "+919789054204",
        email: "",
        campaignName: "Tamil Leads Campaign",
        adsetName: "TN | Qualified Leads | CRM Dataset",
        adName: "Aparna Tamil Registration Free",
        formName: "Dubai Property Tamil Form",
        currentStage: "Lead",
        leadStatus: "CREATED",
        syncStatus: "not_sent",
        answers: {
          "Why are you exploring Dubai property?": "Rental income / investment",
          "What budget range are you considering?": "₹3CR - ₹5CR",
          "Timeline": "3-6 months",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012346",
        fullName: "Priya Rajendran",
        phoneNumber: "+919840011223",
        email: "priya.r@example.com",
        campaignName: "Tamil Leads Campaign",
        adsetName: "TN | Qualified Leads | CRM Dataset",
        adName: "Aparna Tamil Registration Free",
        formName: "Dubai Property Tamil Form",
        currentStage: "Contact",
        leadStatus: "CONTACTED",
        syncStatus: "pending",
        answers: {
          "Why are you exploring Dubai property?": "Want to settle in Dubai",
          "What budget range are you considering?": "₹5CR - ₹8CR",
          "Timeline": "6-12 months",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012347",
        fullName: "Senthil Nathan",
        phoneNumber: "+919962233445",
        email: "senthil.n@example.com",
        campaignName: "Dubai Investment Leads",
        adsetName: "Investors | High Net Worth",
        adName: "Dubai Property ROI Calculator",
        formName: "Dubai Property Tamil Form",
        currentStage: "Prospect",
        leadStatus: "INTERESTED",
        syncStatus: "pending",
        answers: {
          "Why are you exploring Dubai property?": "Investment - high ROI",
          "What budget range are you considering?": "₹10CR+",
          "Timeline": "Immediate",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012348",
        fullName: "Lakshmi Narayanan",
        phoneNumber: "+917358899001",
        email: "lakshmi.n@example.com",
        campaignName: "Tamil Leads Campaign",
        adsetName: "TN | Qualified Leads | CRM Dataset",
        adName: "Dubai Property Tamil Free Guide",
        formName: "Dubai Property Tamil Form",
        currentStage: "ConversionLead",
        leadStatus: "QUALIFIED",
        syncStatus: "pending",
        answers: {
          "Why are you exploring Dubai property?": "Children education & settlement",
          "What budget range are you considering?": "₹5CR - ₹8CR",
          "Timeline": "3-6 months",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012349",
        fullName: "Arunachalam V",
        phoneNumber: "+917209874563",
        email: "arun.v@example.com",
        campaignName: "Dubai Investment Leads",
        adsetName: "Investors | High Net Worth",
        adName: "Dubai Luxury Property Webinar",
        formName: "Dubai Property English Form",
        currentStage: "Purchase",
        leadStatus: "CLOSED",
        syncStatus: "sent",
        lastEventSent: "Purchase",
        lastEventSentAt: now - 86400000,
        answers: {
          "Why are you exploring Dubai property?": "Already invested, looking for next",
          "What budget range are you considering?": "₹10CR+",
          "Timeline": "Already closed",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012350",
        fullName: "Deepa Srinivasan",
        phoneNumber: "+918825671234",
        email: "deepa.s@example.com",
        campaignName: "Tamil Leads Campaign",
        adsetName: "TN | Qualified Leads | CRM Dataset",
        adName: "Dubai Property Tamil Free Guide",
        formName: "Dubai Property Tamil Form",
        currentStage: "NotQualified",
        leadStatus: "DISQUALIFIED",
        syncStatus: "not_sent",
        answers: {
          "Why are you exploring Dubai property?": "Just browsing",
          "What budget range are you considering?": "Under ₹50L",
          "Timeline": "Not sure",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012351",
        fullName: "Ganesh Moorthy",
        phoneNumber: "+919845673210",
        email: "ganesh.m@example.com",
        campaignName: "Dubai Investment Leads",
        adsetName: "General | All Audiences",
        adName: "Dubai Property Awareness",
        formName: "Dubai Property English Form",
        currentStage: "NoResponse",
        leadStatus: "UNREACHABLE",
        syncStatus: "not_sent",
        answers: {
          "Why are you exploring Dubai property?": "Retirement planning",
          "What budget range are you considering?": "₹1CR - ₹3CR",
          "Timeline": "1-2 years",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012352",
        fullName: "Kavitha Chandran",
        phoneNumber: "+919043215678",
        email: "kavitha.c@example.com",
        campaignName: "Tamil Leads Campaign",
        adsetName: "TN | Qualified Leads | CRM Dataset",
        adName: "Dubai Property Tamil Registration Free",
        formName: "Dubai Property Tamil Form",
        currentStage: "Lead",
        leadStatus: "CREATED",
        syncStatus: "not_sent",
        answers: {
          "Why are you exploring Dubai property?": "Job transfer to Dubai",
          "What budget range are you considering?": "₹3CR - ₹5CR",
          "Timeline": "3 months",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012353",
        fullName: "Suresh Babu",
        phoneNumber: "+917698043212",
        email: "suresh.b@example.com",
        campaignName: "Dubai Investment Leads",
        adsetName: "Investors | High Net Worth",
        adName: "Dubai Property ROI Calculator",
        formName: "Dubai Property English Form",
        currentStage: "Contact",
        leadStatus: "CONTACTED",
        syncStatus: "pending",
        answers: {
          "Why are you exploring Dubai property?": "Diversify investment portfolio",
          "What budget range are you considering?": "₹5CR - ₹8CR",
          "Timeline": "6 months",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012354",
        fullName: "Vidhya Shankar",
        phoneNumber: "+919150987654",
        email: "vidhya.s@example.com",
        campaignName: "Tamil Leads Campaign",
        adsetName: "General | All Audiences",
        adName: "Dubai Property Tamil Free Guide",
        formName: "Dubai Property Tamil Form",
        currentStage: "Prospect",
        leadStatus: "INTERESTED",
        syncStatus: "pending",
        answers: {
          "Why are you exploring Dubai property?": "Son studying in Dubai",
          "What budget range are you considering?": "₹3CR - ₹5CR",
          "Timeline": "3-6 months",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012355",
        fullName: "Ramesh Kannan",
        phoneNumber: "+918527634512",
        email: "",
        campaignName: "Tamil Leads Campaign",
        adsetName: "TN | Qualified Leads | CRM Dataset",
        adName: "Aparna Tamil Registration Free",
        formName: "Dubai Property Tamil Form",
        currentStage: "Duplicate",
        leadStatus: "DUPLICATE",
        syncStatus: "not_sent",
        answers: {
          "Why are you exploring Dubai property?": "Rental income",
          "What budget range are you considering?": "₹1CR - ₹3CR",
          "Timeline": "3-6 months",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012356",
        fullName: "Anitha Selvam",
        phoneNumber: "+919632147850",
        email: "anitha.s@example.com",
        campaignName: "Dubai Investment Leads",
        adsetName: "General | All Audiences",
        adName: "Dubai Property Awareness",
        formName: "Dubai Property English Form",
        currentStage: "Invalid",
        leadStatus: "SPAM",
        syncStatus: "not_sent",
        answers: {
          "Why are you exploring Dubai property?": "Not specified",
          "What budget range are you considering?": "Not specified",
          "Timeline": "Not specified",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012357",
        fullName: "Muruganantham P",
        phoneNumber: "+917218093456",
        email: "murugan.p@example.com",
        campaignName: "Tamil Leads Campaign",
        adsetName: "TN | Qualified Leads | CRM Dataset",
        adName: "Dubai Property Tamil Registration Free",
        formName: "Dubai Property Tamil Form",
        currentStage: "Lead",
        leadStatus: "CREATED",
        syncStatus: "not_sent",
        answers: {
          "Why are you exploring Dubai property?": "Business expansion",
          "What budget range are you considering?": "₹5CR - ₹8CR",
          "Timeline": "3-6 months",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012358",
        fullName: "Sivagami Jayaraman",
        phoneNumber: "+914576239018",
        email: "sivagami.j@example.com",
        campaignName: "Dubai Investment Leads",
        adsetName: "Investors | High Net Worth",
        adName: "Dubai Luxury Property Webinar",
        formName: "Dubai Property English Form",
        currentStage: "ConversionLead",
        leadStatus: "QUALIFIED",
        syncStatus: "pending",
        answers: {
          "Why are you exploring Dubai property?": "Premium investment property",
          "What budget range are you considering?": "₹10CR+",
          "Timeline": "Immediate",
        },
        rawPayload: { source: "demo" },
      },
      {
        metaLeadId: "123456789012359",
        fullName: "Balaji Venkatesh",
        phoneNumber: "+918423197865",
        email: "balaji.v@example.com",
        campaignName: "Tamil Leads Campaign",
        adsetName: "TN | Qualified Leads | CRM Dataset",
        adName: "Dubai Property Tamil Free Guide",
        formName: "Dubai Property Tamil Form",
        currentStage: "NoResponse",
        leadStatus: "UNREACHABLE",
        syncStatus: "not_sent",
        answers: {
          "Why are you exploring Dubai property?": "Second home in Dubai",
          "What budget range are you considering?": "₹3CR - ₹5CR",
          "Timeline": "1 year",
        },
        rawPayload: { source: "demo" },
      },
    ];

    for (const lead of demoLeads) {
      const existing = await ctx.db
        .query("leads")
        .withIndex("by_metaLeadId", (q: any) => q.eq("metaLeadId", lead.metaLeadId))
        .first();
      if (existing) continue;

      await ctx.db.insert("leads", {
        ...lead,
        workspaceId: wid,
        createdAt: now - Math.floor(Math.random() * 14 * 86400000),
        updatedAt: now,
      });
    }
  },
});

export const seedDemoWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q: any) => q.eq("slug", DEMO_WORKSPACE_SLUG))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    const id = await ctx.db.insert("workspaces", {
      name: "Ask Arun - Dubai Real Estate",
      slug: DEMO_WORKSPACE_SLUG,
      createdAt: now,
      updatedAt: now,
    });

    // Seed default stages
    const stages = [
      { name: "Lead", key: "Lead", order: 0, type: "other" as const },
      { name: "Contact", key: "Contact", order: 1, type: "other" as const },
      { name: "Prospect", key: "Prospect", order: 2, type: "positive" as const },
      { name: "Conversion Lead", key: "ConversionLead", order: 3, type: "positive" as const },
      { name: "Purchase", key: "Purchase", order: 4, type: "positive" as const },
      { name: "Not Qualified", key: "NotQualified", order: 5, type: "negative" as const },
      { name: "No Response", key: "NoResponse", order: 6, type: "negative" as const },
      { name: "Duplicate", key: "Duplicate", order: 7, type: "negative" as const },
      { name: "Invalid", key: "Invalid", order: 8, type: "negative" as const },
    ];

    for (const stage of stages) {
      await ctx.db.insert("crmStages", {
        ...stage,
        workspaceId: id,
      });
    }

    return id;
  },
});

export const listStageHistoryForLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leadStageHistory")
      .withIndex("by_leadId", (q: any) => q.eq("leadId", args.leadId))
      .order("desc")
      .collect();
  },
});

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const workspaceId = await getWorkspaceId(ctx);
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .collect();

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalLeads = leads.length;
    const newToday = leads.filter((l) => l.createdAt >= todayStart.getTime()).length;
    const contacted = leads.filter((l) => l.currentStage !== "Lead" && l.currentStage !== "Invalid" && l.currentStage !== "Duplicate").length;
    const prospect = leads.filter((l) => l.currentStage === "Prospect").length;
    const conversionLead = leads.filter((l) => l.currentStage === "ConversionLead").length;
    const purchase = leads.filter((l) => l.currentStage === "Purchase").length;
    const notQualified = leads.filter((l) => l.currentStage === "NotQualified").length;
    const noResponse = leads.filter((l) => l.currentStage === "NoResponse").length;

    const pendingEvents = await ctx.db
      .query("conversionLeadEvents")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const failedEvents = await ctx.db
      .query("conversionLeadEvents")
      .filter((q) => q.eq(q.field("status"), "failed"))
      .collect();

    const missingMetaLeadId = leads.filter((l) => !l.metaLeadId).length;
    const missingPhone = leads.filter((l) => !l.phoneNumber).length;

    const tasksDue = await ctx.db
      .query("tasks")
      .filter((q) => q.and(
        q.neq(q.field("status"), "done"),
        q.lte(q.field("dueAt"), now)
      ))
      .collect();

    const stageCounts: Record<string, number> = {};
    for (const l of leads) {
      stageCounts[l.currentStage] = (stageCounts[l.currentStage] || 0) + 1;
    }

    // Funnel: Lead -> Contact -> Prospect -> ConversionLead -> Purchase
    const funnel = [
      { stage: "Lead", count: stageCounts["Lead"] || 0 },
      { stage: "Contact", count: stageCounts["Contact"] || 0 },
      { stage: "Prospect", count: stageCounts["Prospect"] || 0 },
      { stage: "ConversionLead", count: stageCounts["ConversionLead"] || 0 },
      { stage: "Purchase", count: stageCounts["Purchase"] || 0 },
    ];

    return {
      totalLeads,
      newToday,
      contacted,
      prospect,
      conversionLead,
      purchase,
      notQualified,
      noResponse,
      pendingEvents: pendingEvents.length,
      failedEvents: failedEvents.length,
      missingMetaLeadId,
      missingPhone,
      followUpsDue: tasksDue.length,
      funnel,
      stageCounts,
    };
  },
});