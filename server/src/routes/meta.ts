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

// Helper: get page-scoped access token from system user token
async function getPageAccessToken(pageId: string, sysToken: string): Promise<string> {
  const url = `https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${sysToken}`;
  const res = await fetch(url);
  const data: any = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || "Failed to get page access token");
  }
  return data.access_token;
}

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
    // Step 1: Get page-scoped access token
    const pageToken = await getPageAccessToken(META_PAGE_ID, META_ACCESS_TOKEN);

    // Step 2: Get leadgen forms for the page
    const formsUrl = `https://graph.facebook.com/v21.0/${META_PAGE_ID}/leadgen_forms?access_token=${pageToken}`;
    const formsRes = await fetch(formsUrl);
    const formsData: any = await formsRes.json();

    if (!formsRes.ok) {
      res.status(502).json({ error: "Meta API error (forms)", detail: formsData.error || formsData });
      return;
    }

    const forms = formsData.data || [];
    let totalImported = 0;
    let totalUpdated = 0;
    let totalScanned = 0;
    const formIds: string[] = [];

    // Step 3: Get leads from each form
    for (const form of forms) {
      const formId = form.id;
      formIds.push(formId);
      const leadsUrl = `https://graph.facebook.com/v21.0/${formId}/leads?access_token=${pageToken}`;
      const leadsRes = await fetch(leadsUrl);
      const leadsData: any = await leadsRes.json();

      if (!leadsRes.ok) {
        console.error(`Error fetching leads for form ${formId}:`, leadsData.error);
        continue;
      }

      const leads = leadsData.data || [];
      totalScanned += leads.length;

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

        if (result.action === "inserted") totalImported++;
        else totalUpdated++;
      }
    }

    const counts = await getConvex().query("leads:counts");

    res.json({
      formsScanned: forms.length,
      leadsFetched: totalScanned,
      created: totalImported,
      updated: totalUpdated,
      skipped: 0,
      total: counts.total,
    });
  } catch (err: any) {
    console.error("Import error:", err);
    res.status(500).json({ error: "Import failed", detail: err.message });
  }
});

export default router;