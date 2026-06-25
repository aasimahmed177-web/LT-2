import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";
import { resolveClientId } from "../clients.js";

const router = Router();

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PAGE_ID = process.env.META_PAGE_ID;

// GET /api/meta/health
router.get("/health", (_req: Request, res: Response) => {
  const clientId = resolveClientId(_req.query.clientId as string);
  res.json({
    status: "ok",
    metaConfigured: !!(META_ACCESS_TOKEN && META_PAGE_ID),
    pageId: META_PAGE_ID ? META_PAGE_ID.substring(0, 5) + "..." : null,
    clientId,
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

// Helper: paginated fetch that follows paging.next links
async function paginatedFetch(
  url: string,
  limit: number = 100
): Promise<{ allData: any[]; pagesFetched: number }> {
  const allData: any[] = [];
  let pageCount = 0;
  let nextUrl: string | null = url.includes("?")
    ? `${url}&limit=${limit}`
    : `${url}?limit=${limit}`;

  while (nextUrl) {
    pageCount++;
    const res = await fetch(nextUrl);
    const body: any = await res.json();
    if (!res.ok) {
      throw new Error(body.error?.message || `API error at page ${pageCount}`);
    }
    const items = body.data || [];
    allData.push(...items);
    nextUrl = body.paging?.next || null;
  }

  return { allData, pagesFetched: pageCount };
}

// POST /api/meta/import-leads
router.post("/import-leads", async (_req: Request, res: Response) => {
  if (!META_ACCESS_TOKEN || !META_PAGE_ID) {
    res.status(400).json({
      error: "META_ACCESS_TOKEN and META_PAGE_ID must be configured",
    });
    return;
  }

  const clientId = resolveClientId(_req.query.clientId as string);

  try {
    // Step 1: Get page-scoped access token
    const pageToken = await getPageAccessToken(META_PAGE_ID, META_ACCESS_TOKEN);

    // Step 2: Get all leadgen forms for the page (paginated)
    const formsBaseUrl = `https://graph.facebook.com/v21.0/${META_PAGE_ID}/leadgen_forms?access_token=${pageToken}&fields=id,name,status`;
    const { allData: forms, pagesFetched: formsPages } = await paginatedFetch(formsBaseUrl, 100);

    let totalImported = 0;
    let totalUpdated = 0;
    let totalFetched = 0;
    const formResults: {
      formId: string;
      formName: string;
      status: string;
      leadsFetched: number;
      pagesFetched: number;
      error: string | null;
    }[] = [];

    // Step 3: Get leads from each form (paginated, limit=100)
    for (const form of forms) {
      const formId = form.id;
      const formName = form.name || formId;
      const status = form.status || "UNKNOWN";
      const formEntry: typeof formResults[0] = {
        formId,
        formName,
        status,
        leadsFetched: 0,
        pagesFetched: 0,
        error: null,
      };

      try {
        const leadsUrl = `https://graph.facebook.com/v21.0/${formId}/leads?access_token=${pageToken}`;
        const { allData: leads, pagesFetched } = await paginatedFetch(leadsUrl, 100);

        formEntry.leadsFetched = leads.length;
        formEntry.pagesFetched = pagesFetched;
        totalFetched += leads.length;

        for (const lead of leads) {
          const metaLeadId = lead.id;
          const fieldData = lead.field_data || [];
          const { name, email, phone } = extractContactFields(fieldData);

          const result = await getConvex().mutation("leads:upsertMetaLead", {
            clientId,
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
            formName,
            formId,
          });

          if (result.action === "inserted") totalImported++;
          else totalUpdated++;
        }
      } catch (err: any) {
        formEntry.error = err.message;
      }

      formResults.push(formEntry);
    }

    const counts = await getConvex().query("leads:counts");

    const result = {
      formsScanned: forms.length,
      formsPagesFetched: formsPages,
      leadsFetched: totalFetched,
      created: totalImported,
      updated: totalUpdated,
      skipped: 0,
      total: counts.total,
      forms: formResults,
      errors: formResults.filter((f) => f.error).map((f) => ({ formId: f.formId, formName: f.formName, error: f.error })),
      clientId,
    };

    // Persist last sync result
    await getConvex().mutation("importResults:record", { data: result }).catch((err: any) => {
      console.error("Failed to persist import result:", err.message);
    });

    res.json(result);
  } catch (err: any) {
    console.error("Import error:", err);
    res.status(500).json({ error: "Import failed", detail: err.message });
  }
});

// GET /api/meta/last-import-result
router.get("/last-import-result", async (_req: Request, res: Response) => {
  try {
    const result = await getConvex().query("importResults:getLast");
    res.json(result || { lastSyncedAt: null });
  } catch (err: any) {
    console.error("Last import result error:", err.message);
    res.json({ lastSyncedAt: null });
  }
});

export default router;