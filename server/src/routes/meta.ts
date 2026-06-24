import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";

const router = Router();

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PAGE_ID = process.env.META_PAGE_ID;

// GET /api/meta/health
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    metaConfigured: !!(META_ACCESS_TOKEN && META_PAGE_ID),
    pageId: META_PAGE_ID ? META_PAGE_ID.substring(0, 5) + "..." : null,
  });
});

// Helper to extract name/email/phone from field_data
function extractContactFields(fieldData: any[]) {
  let name: string | undefined;
  let email: string | undefined;
  let phone: string | undefined;
  for (const field of fieldData || []) {
    const val = field.values?.[0];
    if (!val) continue;
    const nameLower = (field.name || "").toLowerCase();
    if (nameLower.includes("full_name") || nameLower === "name" || nameLower === "full name") {
      name = val;
    } else if (nameLower.includes("email")) {
      email = val;
    } else if (nameLower.includes("phone")) {
      phone = val;
    }
  }
  return { name, email, phone };
}

// POST /api/meta/import-leads
router.post("/import-leads", async (_req: Request, res: Response) => {
  if (!META_ACCESS_TOKEN || !META_PAGE_ID) {
    res.status(400).json({
      error: "META_ACCESS_TOKEN and META_PAGE_ID must be configured",
    });
    return;
  }

  try {
    // Fetch leads from Meta Graph API
    const url = `https://graph.facebook.com/v21.0/${META_PAGE_ID}/leads?access_token=${META_ACCESS_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      res.status(502).json({
        error: "Meta API error",
        detail: data.error || data,
      });
      return;
    }

    const leads = data.data || [];
    if (leads.length === 0) {
      res.json({ imported: 0, updated: 0, total: 0, message: "No new leads found on Meta" });
      return;
    }

    let imported = 0;
    let updated = 0;

    for (const lead of leads) {
      const metaLeadId = lead.id;
      const fieldData = lead.field_data || [];
      const { name, email, phone } = extractContactFields(fieldData);

      const result = await getConvex().mutation("leads:upsertMetaLead", {
        metaLeadId,
        adId: lead.ad_id,
        adName: lead.ad_name,
        adSetId: lead.adset_id,
        adSetName: lead.adset_name,
        campaignId: lead.campaign_id,
        campaignName: lead.campaign_name,
        pageId: lead.page_id,
        fieldData,
        fullResponse: lead,
        ingestedAt: new Date().toISOString(),
        name,
        email,
        phone,
      });

      if (result.action === "inserted") imported++;
      else updated++;
    }

    const counts = await getConvex().query("leads:counts");

    res.json({
      imported,
      updated,
      total: counts.total,
      byStage: counts.byStage,
    });
  } catch (err: any) {
    console.error("Import error:", err.message);
    res.status(500).json({ error: "Import failed", detail: err.message });
  }
});

export default router;