import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getConvex } from "../convexClient.js";
import { resolveClientId, resolveConvexClientId } from "../clients.js";

const router = Router();

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PAGE_ID = process.env.META_PAGE_ID;
const META_CAPI_DRY_RUN = process.env.META_CAPI_DRY_RUN !== "false"; // default to dry-run for safety
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || null;

// GET /api/meta/health
router.get("/health", (_req: Request, res: Response) => {
  const clientId = resolveClientId(_req.query.clientId as string);
  const pixelId = process.env.META_PIXEL_ID;
  res.json({
    status: "ok",
    metaConfigured: !!(META_ACCESS_TOKEN && META_PAGE_ID),
    pageId: META_PAGE_ID ? META_PAGE_ID.substring(0, 5) + "..." : null,
    pageIdConfigured: !!META_PAGE_ID,
    tokenConfigured: !!META_ACCESS_TOKEN,
    pixelIdConfigured: !!pixelId,
    pixelId: pixelId ? pixelId.substring(0, 4) + "..." : null,
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
  const convexClientId = resolveConvexClientId(clientId);
  let syncRunId: string | null = null;

  try {
    // Step 0: Create sync run tracking
    try {
      syncRunId = await getConvex().mutation("clients:createSyncRun", { clientId: convexClientId, formsScanned: 0, leadsFetched: 0 });
    } catch { /* sync run tracking is best-effort */ }

    // Step 1: Get page-scoped access token
    const pageToken = await getPageAccessToken(META_PAGE_ID, META_ACCESS_TOKEN);

    // Step 2: Get all leadgen forms for the page (paginated)
    const formsBaseUrl = `https://graph.facebook.com/v21.0/${META_PAGE_ID}/leadgen_forms?access_token=${pageToken}&fields=id,name,status`;
    const { allData: forms, pagesFetched: formsPages } = await paginatedFetch(formsBaseUrl, 100);

    // Persist forms in leadForms table
    try {
      await getConvex().mutation("clients:setLeadForms", {
        clientId: convexClientId,
        forms: forms.map((f: any) => ({ formId: f.id, formName: f.name || f.id, status: f.status || "ACTIVE" })),
      });
    } catch (err: any) {
      console.error("Failed to persist lead forms:", err.message);
    }

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
            clientId: convexClientId,
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

// Complete sync run
    if (syncRunId) {
      try {
        await getConvex().mutation("clients:completeSyncRun", {
          syncRunId,
          created: totalImported,
          updated: totalUpdated,
          skipped: 0,
          total: counts.total,
          perForm: formResults.map((f) => ({ formId: f.formId, formName: f.formName, status: f.status, leadsFetched: f.leadsFetched, error: f.error })),
          formsScanned: forms.length,
          leadsFetched: totalFetched,
        });
      } catch (err: any) {
        console.error("Failed to complete sync run:", err.message);
      }
    }
    res.json(result);
  } catch (err: any) {
    // Fail sync run if one was created
    if (syncRunId) {
      try {
        await getConvex().mutation("clients:failSyncRun", { syncRunId, error: err.message });
      } catch { /* ignore */ }
    }
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

// ─── CAPI Helpers ────────────────────────────────────────────────

function hashValue(val: string): string {
  return crypto.createHash("sha256").update(val.toLowerCase().trim()).digest("hex");
}

function hashPhone(phone: string): string {
  // Strip all non-digit characters
  let cleaned = phone.replace(/[^\d]/g, "");
  // Indian normalization: if 10-digit number, prepend 91
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  // SHA256 hash the normalized phone (Meta requires hashed ph)
  return crypto.createHash("sha256").update(cleaned).digest("hex");
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] || "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { first, last };
}

async function sendCapiEvent(convexEventId: string): Promise<{ success: boolean; response?: string; error?: string }> {
  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) {
    return { success: false, error: "META_PIXEL_ID is not configured" };
  }
  if (!META_ACCESS_TOKEN) {
    return { success: false, error: "META_ACCESS_TOKEN is not configured" };
  }

  try {
    // Get the event record from Convex
    const event: any = await getConvex().query("crm:getCapiEventById", { id: convexEventId });
    if (!event) return { success: false, error: "Event not found" };
    if (event.status === "sent") return { success: true, response: "Already sent" };
    if (event.status === "cancelled") return { success: false, error: "Event has been cancelled" };
    if (event.status === "skipped") return { success: false, error: "Event was skipped (dry-run), cannot send" };
    if (event.status === "dry_run") return { success: false, error: "Event is in dry-run state, cannot send" };

    // Get lead details for user_data hashing
    const lead: any = await getConvex().query("leads:getById", { id: event.leadId });
    if (!lead) return { success: false, error: "Lead not found" };

    // Build user_data with hashed fields
    const userData: Record<string, any> = {};
    if (lead.email) userData.em = hashValue(lead.email);
    if (lead.phone) userData.ph = hashPhone(lead.phone);
    if (lead.name) {
      const { first, last } = splitName(lead.name);
      if (first) userData.fn = hashValue(first);
      if (last) userData.ln = hashValue(last);
    }
    if (lead.metaLeadId) {
      userData.external_id = hashValue(lead.metaLeadId);
      // lead_id is the raw Facebook lead ID (unhashed integer) for better matching
      userData.lead_id = parseInt(lead.metaLeadId, 10) || lead.metaLeadId;
    } else if (lead._id) {
      userData.external_id = hashValue(lead._id);
    }

    // Build custom_data — non-sensitive audit fields only
    // lead_event_source goes inside custom_data per Meta's CAPI spec for Qualified Leads
    const customData: Record<string, any> = {
      event_source: "crm",          // Required by Meta for CRM event quality scoring
      lead_event_source: "LeadTrace CRM",  // Identifies the CRM system to Meta
      crm_stage: event.stage,
      source: "leadtrace_crm",
    };
    if (lead.metaLeadId) customData.meta_lead_id = lead.metaLeadId;
    if (lead._id) customData.leadtrace_lead_id = lead._id;
    if (lead.formName) customData.form_name = lead.formName;
    if (lead.adName) {
      customData.ad_name = lead.adName;
      // Derive caller from ad_name
      const nameLower = lead.adName.toLowerCase();
      if (nameLower.includes("aparna")) customData.caller = "Aparna";
      else if (nameLower.includes("suganya")) customData.caller = "Suganya";
    }

    // Build original_event_data from the lead's Meta creation time (for attribution)
    const originalEventData: Record<string, any> = {};
    let originalEventTime: number | undefined;
    if (lead.fullResponse?.created_time) {
      originalEventTime = Math.floor(new Date(lead.fullResponse.created_time).getTime() / 1000);
    }
    if (originalEventTime) {
      originalEventData.event_name = event.eventName;
      originalEventData.event_time = originalEventTime;
    }

    // Build the CAPI payload
    const payload: any = {
      data: [
        {
          event_name: event.eventName,
          event_time: event.eventTime || Math.floor(Date.now() / 1000),
          event_id: event.eventId || `${event.metaLeadId}_${event.stage}_${Date.now()}`,
          action_source: event.action_source || "system_generated",
          user_data: userData,
          custom_data: customData,
        },
      ],
    };

    // Add original_event_data for Qualified Leads events (required by Meta for proper attribution)
    if (Object.keys(originalEventData).length > 0) {
      payload.data[0].original_event_data = originalEventData;
    }

    // Add test_event_code if configured
    if (META_TEST_EVENT_CODE) {
      payload.test_event_code = META_TEST_EVENT_CODE;
    }

    // Dry-run check
    if (META_CAPI_DRY_RUN) {
      console.log(`[CAPI DRY-RUN] Would send event:`, JSON.stringify(payload, null, 2));
      return { success: true, response: "Dry-run mode: event recorded but not sent" };
    }

    // Send to Meta Graph API
    const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${META_ACCESS_TOKEN}`;
    const fbRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const fbData: any = await fbRes.json();

    if (fbRes.ok && fbData.events_received === 1) {
      return { success: true, response: `Meta accepted: ${fbData.events_received} event(s) received` };
    } else {
      const errMsg = fbData.error?.message || fbData.error?.error_user_msg || JSON.stringify(fbData);
      return { success: false, error: errMsg, response: JSON.stringify(fbData).substring(0, 500) };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── CAPI Endpoints ──────────────────────────────────────────────

// GET /api/meta/capi-status - check CAPI configuration
router.get("/capi-status", (_req: Request, res: Response) => {
  const pixelId = process.env.META_PIXEL_ID;
  const dryRun = META_CAPI_DRY_RUN;
  res.json({
    pixelIdConfigured: !!pixelId,
    pixelId: pixelId ? pixelId.substring(0, 4) + "..." : null,
    tokenConfigured: !!META_ACCESS_TOKEN,
    dryRun,
    testEventCodeConfigured: !!META_TEST_EVENT_CODE,
    capiCapable: !!(pixelId && META_ACCESS_TOKEN),
  });
});

// POST /api/meta/send-capi-event - send a pending CAPI event by its Convex event ID
router.post("/send-capi-event", async (_req: Request, res: Response) => {
  try {
    const { eventId } = _req.body;
    if (!eventId) {
      res.status(400).json({ error: "eventId is required" });
      return;
    }

    const result = await sendCapiEvent(eventId);

    // Get current event to read attempts
    let currentAttempts = 0;
    try {
      const event: any = await getConvex().query("crm:getCapiEventById", { id: eventId });
      currentAttempts = event?.attempts || 0;
    } catch { /* ignore */ }

    if (result.success) {
      const status = META_CAPI_DRY_RUN ? "skipped" : "sent";
      await getConvex().mutation("crm:updateCapiEventStatus", {
        eventId: eventId as any,
        status,
        response: result.response,
        attempts: currentAttempts + 1,
      });
      res.json({ success: true, status, response: result.response });
    } else {
      await getConvex().mutation("crm:updateCapiEventStatus", {
        eventId: eventId as any,
        status: "failed",
        error: result.error,
        response: result.response,
        attempts: currentAttempts + 1,
      });
      res.json({ success: false, status: "failed", error: result.error });
    }
  } catch (err: any) {
    console.error("CAPI send error:", err.message);
    res.status(500).json({ error: "Failed to send CAPI event", detail: err.message });
  }
});

// GET /api/meta/preview-payload/:leadId — safe redacted preview of a CAPI payload for one lead (never sends to Meta)
router.get("/preview-payload/:leadId", async (req: Request, res: Response) => {
  try {
    const lead: any = await getConvex().query("leads:getById", { id: req.params.leadId as string });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    // Build user_data with redacted hashes (first 6 chars only)
    const userDataPreview: Record<string, string> = {};

    if (lead.email) {
      const hash = hashValue(lead.email);
      userDataPreview.em = hash.substring(0, 6) + "...";
    }
    if (lead.phone) {
      const hash = hashPhone(lead.phone);
      userDataPreview.ph = hash.substring(0, 6) + "...";
    }
    if (lead.name) {
      const { first, last } = splitName(lead.name);
      if (first) {
        const hash = hashValue(first);
        userDataPreview.fn = hash.substring(0, 6) + "...";
      }
      if (last) {
        const hash = hashValue(last);
        userDataPreview.ln = hash.substring(0, 6) + "...";
      }
    }
    if (lead.metaLeadId) {
      const hash = hashValue(lead.metaLeadId);
      userDataPreview.external_id = hash.substring(0, 6) + "...";
      // lead_id is the raw Facebook lead ID (unhashed integer)
      userDataPreview.lead_id = lead.metaLeadId.substring(0, 6) + "...";
    } else if (lead._id) {
      const hash = hashValue(lead._id);
      userDataPreview.external_id = hash.substring(0, 6) + "...";
    }

    // Build original_event_data preview from lead's Meta creation time
    let originalEventTime: number | undefined;
    if (lead.fullResponse?.created_time) {
      originalEventTime = Math.floor(new Date(lead.fullResponse.created_time).getTime() / 1000);
    }

    res.json({
      leadId: lead._id,
      name: lead.name ? `${lead.name.substring(0, 2)}...` : undefined,
      phoneAvailable: !!lead.phone,
      emailAvailable: !!lead.email,
      metaLeadId: lead.metaLeadId ? `${lead.metaLeadId.substring(0, 6)}...` : undefined,
      userData: userDataPreview,
      customData: {
        event_source: "crm",
        lead_event_source: "LeadTrace CRM",
        crm_stage: lead.stage,
        source: "leadtrace_crm",
        meta_lead_id: lead.metaLeadId || undefined,
        leadtrace_lead_id: lead._id,
        form_name: lead.formName || undefined,
        ad_name: lead.adName || undefined,
      },
      eventData: {
        action_source: "system_generated",
      },
      originalEventData: originalEventTime ? {
        event_name: "Lead",
        event_time: originalEventTime,
      } : undefined,
      fieldsPresent: Object.keys(userDataPreview),
      fieldsMissing: [
        ...(!lead.email ? ["em (email not available)"] : []),
        ...(!lead.phone ? ["ph (phone not available)"] : []),
        ...(!lead.name ? ["fn, ln (name not available)"] : []),
        ...(!lead.metaLeadId && !lead._id ? ["external_id (no ID available)"] : []),
      ],
      warning: "REDACTED PREVIEW — No event was sent to Meta. Hash prefixes shown (first 6 chars).",
    });
  } catch (err: any) {
    console.error("Preview payload error:", err.message);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

// POST /api/meta/cancel-capi-event - cancel a pending/failed CAPI event
router.post("/cancel-capi-event", async (_req: Request, res: Response) => {
  try {
    const { eventId } = _req.body;
    if (!eventId) {
      res.status(400).json({ error: "eventId is required" });
      return;
    }

    // Get the event to verify it exists and can be cancelled
    const event: any = await getConvex().query("crm:getCapiEventById", { id: eventId });
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    // Only allow cancelling pending or failed events
    if (event.status === "sent") {
      res.status(400).json({ error: "Cannot cancel a sent event" });
      return;
    }
    if (event.status === "cancelled") {
      res.json({ success: true, status: "cancelled", message: "Event was already cancelled" });
      return;
    }
    if (event.status === "skipped" || event.status === "dry_run") {
      res.status(400).json({ error: `Cannot cancel an event in '${event.status}' state; use delete only` });
      return;
    }

    // Mark as cancelled
    await getConvex().mutation("crm:updateCapiEventStatus", {
      eventId: eventId as any,
      status: "cancelled",
    });

    res.json({ success: true, status: "cancelled", message: "Event cancelled" });
  } catch (err: any) {
    console.error("Cancel event error:", err.message);
    res.status(500).json({ error: "Failed to cancel event", detail: err.message });
  }
});

// POST /api/meta/resend-events — reset all sent events to pending and re-send them with improved payload
router.post("/resend-events", async (_req: Request, res: Response) => {
  try {
    const pixelId = process.env.META_PIXEL_ID;
    if (!pixelId || !META_ACCESS_TOKEN) {
      res.status(400).json({ error: "CAPI not configured (pixel or token missing)" });
      return;
    }

    // Get all events from Convex
    let allEvents: any[];
    try {
      allEvents = await getConvex().query("crm:listEvents");
    } catch {
      res.status(500).json({ error: "Failed to query events from Convex" });
      return;
    }

    // Filter for "sent" events
    const sentEvents = allEvents.filter((e: any) => e.status === "sent");
    if (sentEvents.length === 0) {
      res.json({ success: true, message: "No sent events to resend", total: 0 });
      return;
    }

    const results: { eventId: string; eventName: string; status: string; error?: string }[] = [];
    let sent = 0;
    let failed = 0;

    for (const event of sentEvents) {
      try {
        // Get the lead for user_data hashing
        const lead: any = await getConvex().query("leads:getById", { id: event.leadId });
        if (!lead) {
          results.push({ eventId: event._id, eventName: event.eventName, status: "failed", error: "Lead not found" });
          failed++;
          continue;
        }

        // Build user_data with hashed fields
        const userData: Record<string, any> = {};
        if (lead.email) userData.em = hashValue(lead.email);
        if (lead.phone) userData.ph = hashPhone(lead.phone);
        if (lead.name) {
          const { first, last } = splitName(lead.name);
          if (first) userData.fn = hashValue(first);
          if (last) userData.ln = hashValue(last);
        }
        if (lead.metaLeadId) {
          userData.external_id = hashValue(lead.metaLeadId);
          // lead_id is the raw Facebook lead ID (unhashed integer) for better matching
          userData.lead_id = parseInt(lead.metaLeadId, 10) || lead.metaLeadId;
        } else if (lead._id) {
          userData.external_id = hashValue(lead._id);
        }

        // Build custom_data with lead_event_source inside custom_data per Meta spec
        const customData: Record<string, any> = {
          event_source: "crm",
          lead_event_source: "LeadTrace CRM",
          crm_stage: event.stage,
          source: "leadtrace_crm",
        };
        if (lead.metaLeadId) customData.meta_lead_id = lead.metaLeadId;
        if (lead._id) customData.leadtrace_lead_id = lead._id;
        if (lead.formName) customData.form_name = lead.formName;
        if (lead.adName) customData.ad_name = lead.adName;

        // Build original_event_data from the lead's Meta creation time
        const originalEventData: Record<string, any> = {};
        let originalEventTime: number | undefined;
        if (lead.fullResponse?.created_time) {
          originalEventTime = Math.floor(new Date(lead.fullResponse.created_time).getTime() / 1000);
        }
        if (originalEventTime) {
          originalEventData.event_name = event.eventName;
          originalEventData.event_time = originalEventTime;
        }

        // Generate a unique event_id for resend to avoid Meta deduplication
        const resendEventId = `${event.eventId || `${lead.metaLeadId}_${event.stage}`}_resend_${Date.now()}`;

        // Build the CAPI payload with improved fields
        const payload: any = {
          data: [
            {
              event_name: event.eventName,
              event_time: Math.floor(Date.now() / 1000),
              event_id: resendEventId,
              action_source: event.action_source || "system_generated",
              user_data: userData,
              custom_data: customData,
            },
          ],
        };

        // Add original_event_data for Qualified Leads events (required by Meta for proper attribution)
        if (Object.keys(originalEventData).length > 0) {
          payload.data[0].original_event_data = originalEventData;
        }

        if (META_TEST_EVENT_CODE) {
          payload.test_event_code = META_TEST_EVENT_CODE;
        }

        // Send to Meta Graph API
        const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${META_ACCESS_TOKEN}`;
        const fbRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const fbData: any = await fbRes.json();

        if (fbRes.ok && fbData.events_received === 1) {
          // Reset to pending then send via the normal flow too
          await getConvex().mutation("crm:updateCapiEventStatus", {
            eventId: event._id,
            status: "sent",
            response: `Resent: ${fbData.events_received} event(s) received`,
            attempts: (event.attempts || 0) + 1,
          });
          results.push({ eventId: event._id, eventName: event.eventName, status: "sent" });
          sent++;
        } else {
          const errMsg = fbData.error?.message || fbData.error?.error_user_msg || JSON.stringify(fbData);
          results.push({ eventId: event._id, eventName: event.eventName, status: "failed", error: errMsg });
          failed++;
        }
      } catch (err: any) {
        results.push({ eventId: event._id, eventName: event.eventName, status: "error", error: err.message });
        failed++;
      }
    }

    res.json({
      success: true,
      summary: { total: sentEvents.length, sent, failed },
      results,
    });
  } catch (err: any) {
    console.error("Resend events error:", err.message);
    res.status(500).json({ error: "Failed to resend events", detail: err.message });
  }
});

export default router;