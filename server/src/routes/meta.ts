import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getConvex } from "../convexClient.js";
import { getClients, resolveClientId, resolveConvexClientId, checkDeployStatus } from "../clients.js";

// Thrown when required Meta env config is missing — callers can distinguish this
// from transient/API failures (e.g. to return a 400 instead of a 500 over HTTP).
export class MetaConfigError extends Error {}

// Must match convex/crm.ts's STAGE_HIERARCHY — used to order/compare pending
// CAPI events when sending the "ladder" of funnel stages for a lead.
const STAGE_HIERARCHY: Record<string, number> = {
  Lead: 0,
  Contact: 1,
  Prospect: 2,
  ConversionLead: 3,
  Purchase: 4,
};

const router = Router();

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PAGE_ID = process.env.META_PAGE_ID;
const META_CAPI_DRY_RUN = process.env.META_CAPI_DRY_RUN !== "false"; // default to dry-run for safety
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || null;

// CAPI send mode: "final_stage_only" prevents sending lower-stage events when a higher-stage one exists.
const CAPI_SEND_MODE = process.env.CAPI_SEND_MODE || "final_stage_only";

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

// Core lead-import logic, independent of Express req/res so it can be called
// directly from a scheduled/cron job (Netlify Scheduled Function) as well as
// the HTTP route below.
export async function importLeadsForClient(rawClientId?: string) {
  if (!META_ACCESS_TOKEN || !META_PAGE_ID) {
    throw new MetaConfigError("META_ACCESS_TOKEN and META_PAGE_ID must be configured");
  }

  // Ensure the logical->Convex client ID mapping is populated within THIS
  // invocation before resolving IDs — in a serverless deployment there's no
  // guarantee an earlier request already warmed this container's in-memory
  // state, and passing an unresolved logical ID (e.g. "default") into a
  // Convex mutation expecting v.id("clients") fails validation for every lead.
  await checkDeployStatus();

  const clientId = resolveClientId(rawClientId);
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

          if (result.action === "inserted") {
            totalImported++;
            // Send the "Lead" CAPI event created by leads:upsertMetaLead for
            // this brand-new lead (fire-and-forget — never block the import).
            sendPendingCapiEventsForLead(metaLeadId, result.id).catch((e: any) => {
              console.error("[CAPI] Background send error (new lead):", e.message);
            });
          } else {
            totalUpdated++;
          }
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
    return result;
  } catch (err: any) {
    // Fail sync run if one was created
    if (syncRunId) {
      try {
        await getConvex().mutation("clients:failSyncRun", { syncRunId, error: err.message });
      } catch { /* ignore */ }
    }
    throw err;
  }
}

// Runs importLeadsForClient() for every known client — used by the Netlify
// scheduled function (and the standalone dev server's setInterval loop) in
// place of the old self-HTTP-call pattern, which only works when there's a
// persistent localhost server to call.
export async function runImportForAllClients() {
  const results: { clientId: string; clientName: string; result?: any; error?: string }[] = [];
  for (const client of getClients()) {
    try {
      const result = await importLeadsForClient(client.id);
      results.push({ clientId: client.id, clientName: client.name, result });
    } catch (err: any) {
      results.push({ clientId: client.id, clientName: client.name, error: err.message });
    }
  }
  return results;
}

// POST /api/meta/import-leads
router.post("/import-leads", async (req: Request, res: Response) => {
  try {
    const result = await importLeadsForClient(req.query.clientId as string);
    res.json(result);
  } catch (err: any) {
    if (err instanceof MetaConfigError) {
      res.status(400).json({ error: err.message });
      return;
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

// Meta requires `ph` to be hashed only after normalizing to digits-only E.164
// (country code + subscriber number, no `+`, no leading zeros, no symbols).
// This is a heuristic, not a full phone-number library: it handles explicit
// "+"/"00" international prefixes and a single national trunk "0", and only
// falls back to DEFAULT_PHONE_COUNTRY_CODE for bare national-length numbers.
// For fully robust multi-country parsing, swap this for libphonenumber-js.
function normalizePhoneDigits(phone: string): string {
  const defaultCountryCode = (process.env.DEFAULT_PHONE_COUNTRY_CODE || "91").replace(/\D/g, "");

  const hadPlus = phone.trim().startsWith("+");
  let cleaned = phone.replace(/\D/g, "");

  if (hadPlus) {
    // Already has an explicit country code — trust it as-is.
    return cleaned;
  }

  // "00" international dialing prefix is equivalent to "+"
  if (cleaned.startsWith("00")) {
    return cleaned.slice(2);
  }

  // Single national trunk prefix (e.g. "0" + 10-digit local number)
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  // Bare national number (no country code) — apply the configured default.
  if (cleaned.length === 10) {
    cleaned = defaultCountryCode + cleaned;
  }

  return cleaned;
}

function hashPhone(phone: string): string {
  // SHA256 hash the normalized phone (Meta requires hashed ph)
  return crypto.createHash("sha256").update(normalizePhoneDigits(phone)).digest("hex");
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] || "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { first, last };
}

// Meta's Conversion Leads CRM integration docs mark user_data.lead_id (the raw,
// UNHASHED leadgen_id from the Lead Ads webhook) as the highest-priority match
// key — "if sending lead_id, please use a valid lead_id or else the system
// will reject the event." Facebook lead IDs can be 15-17 digits, which exceeds
// Number.MAX_SAFE_INTEGER, so we never pass it through a JS Number (that can
// silently round it) — instead we splice the raw digit string into the
// serialized JSON as a literal, matching the bare-integer format Meta expects.
const LEAD_ID_PLACEHOLDER = "__LEAD_ID_PLACEHOLDER__";

function leadIdDigits(metaLeadId?: string): string | undefined {
  return metaLeadId && /^\d+$/.test(metaLeadId) ? metaLeadId : undefined;
}

function serializeCapiPayload(payload: any, rawLeadId?: string): string {
  const json = JSON.stringify(payload);
  return rawLeadId ? json.replace(`"${LEAD_ID_PLACEHOLDER}"`, rawLeadId) : json;
}

export async function sendCapiEvent(
  convexEventId: string
): Promise<{ success: boolean; response?: string; error?: string; payload?: string }> {
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
    const userData: Record<string, string> = {};
    if (lead.email) userData.em = hashValue(lead.email);
    if (lead.phone) userData.ph = hashPhone(lead.phone);
    if (lead.name) {
      const { first, last } = splitName(lead.name);
      if (first) userData.fn = hashValue(first);
      if (last) userData.ln = hashValue(last);
    }
    if (lead.metaLeadId) {
      userData.external_id = hashValue(lead.metaLeadId);
    } else if (lead._id) {
      userData.external_id = hashValue(lead._id);
    }
    const rawLeadId = leadIdDigits(lead.metaLeadId);
    if (rawLeadId) {
      // Placeholder only — the real digits get spliced in at serialization time.
      (userData as any).lead_id = LEAD_ID_PLACEHOLDER;
    }

    // Build custom_data. lead_event_source + event_source are REQUIRED by
    // Meta for the event to register as a Conversion Leads event at all —
    // without them, Meta silently treats it as a generic CAPI event instead.
    const customData: Record<string, any> = {
      lead_event_source: "LeadTrace CRM",
      event_source: "crm",
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
    // value/currency give Meta a revenue/ROAS signal — only meaningful on the
    // Purchase event, and only when we actually have a (best-effort) estimate.
    if (event.stage === "Purchase" && typeof lead.dealValueEstimate === "number") {
      customData.value = lead.dealValueEstimate;
      customData.currency = lead.dealValueCurrency || "INR";
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

    // Add test_event_code if configured
    if (META_TEST_EVENT_CODE) {
      payload.test_event_code = META_TEST_EVENT_CODE;
    }

    const body = serializeCapiPayload(payload, rawLeadId);

    // Dry-run check
    if (META_CAPI_DRY_RUN) {
      console.log(`[CAPI DRY-RUN] Would send event:`, body);
      return { success: true, response: "Dry-run mode: event recorded but not sent", payload: body };
    }

    // Send to Meta Graph API
    const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${META_ACCESS_TOKEN}`;
    const fbRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const fbData: any = await fbRes.json();

    if (fbRes.ok && fbData.events_received === 1) {
      return { success: true, response: `Meta accepted: ${fbData.events_received} event(s) received`, payload: body };
    } else {
      const errMsg = fbData.error?.message || fbData.error?.error_user_msg || JSON.stringify(fbData);
      return { success: false, error: errMsg, response: JSON.stringify(fbData).substring(0, 500), payload: body };
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

// Sends a pending CAPI event and records the resulting status on it. Shared
// by the HTTP route below and sendPendingCapiEventsForLead() (called directly,
// in-process, from stage-change/ingestion handlers — not over HTTP, since
// there's no localhost server to call inside a Netlify Function).
export async function sendAndRecordCapiEvent(
  eventId: string
): Promise<{ success: boolean; status: string; response?: string; error?: string }> {
  const result = await sendCapiEvent(eventId);

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
      payloadSent: result.payload,
    });
    return { success: true, status, response: result.response };
  } else {
    await getConvex().mutation("crm:updateCapiEventStatus", {
      eventId: eventId as any,
      status: "failed",
      error: result.error,
      response: result.response,
      attempts: currentAttempts + 1,
      payloadSent: result.payload,
    });
    return { success: false, status: "failed", error: result.error };
  }
}

// Sends every pending CAPI event for a lead, in ascending funnel order (Lead,
// Contact, QualifiedLead, ...) — a single stage jump can produce several
// pending "ladder" events at once (see crm:updateStage), and Meta should
// receive them in funnel order rather than arbitrarily/in parallel.
export async function sendPendingCapiEventsForLead(leadId: string, convexLeadId: string): Promise<void> {
  try {
    const events: any[] = await getConvex().query("crm:listEventsByLead", { leadId: convexLeadId as any });
    const pendingEvents = events
      .filter((e: any) => e.status === "pending" && e.eventId)
      .sort((a: any, b: any) => (STAGE_HIERARCHY[a.stage] ?? -1) - (STAGE_HIERARCHY[b.stage] ?? -1));
    if (pendingEvents.length === 0) return;

    if (!process.env.META_PIXEL_ID || !META_ACCESS_TOKEN) {
      console.log(`[CAPI] Skipping ${pendingEvents.length} pending event(s) for lead ${leadId}: CAPI not configured`);
      return;
    }

    for (const pendingEvent of pendingEvents) {
      const pendingScore = STAGE_HIERARCHY[pendingEvent.stage] ?? -1;
      const hasHigherSent = events.some(
        (e: any) => e.status === "sent" && (STAGE_HIERARCHY[e.stage] ?? -1) > pendingScore
      );
      if (hasHigherSent) {
        console.log(`[CAPI] Suppressing ${pendingEvent.eventName} (${pendingEvent.stage}) for lead ${leadId}: higher-stage event already sent`);
        await getConvex().mutation("crm:updateCapiEventStatus", {
          eventId: pendingEvent._id as any,
          status: "suppressed",
          response: "Superseded by higher-stage event",
        });
        continue;
      }

      try {
        const result = await sendAndRecordCapiEvent(pendingEvent._id);
        if (result.success) {
          console.log(`[CAPI] Event ${pendingEvent.eventName} (${pendingEvent.stage}) sent for lead ${leadId}: ${result.status}`);
        } else {
          console.log(`[CAPI] Event ${pendingEvent.eventName} (${pendingEvent.stage}) failed for lead ${leadId}: ${result.error}`);
        }
      } catch (sendErr: any) {
        console.error(`[CAPI] Send error for ${pendingEvent.eventName} (${pendingEvent.stage}), lead ${leadId}:`, sendErr.message);
      }
    }
  } catch (err: any) {
    console.error("[CAPI] sendPendingCapiEventsForLead error:", err.message);
  }
}

// POST /api/meta/send-capi-event - send a pending CAPI event by its Convex event ID
router.post("/send-capi-event", async (_req: Request, res: Response) => {
  try {
    const { eventId } = _req.body;
    if (!eventId) {
      res.status(400).json({ error: "eventId is required" });
      return;
    }

    const result = await sendAndRecordCapiEvent(eventId);
    res.json(result);
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
    } else if (lead._id) {
      const hash = hashValue(lead._id);
      userDataPreview.external_id = hash.substring(0, 6) + "...";
    }
    // lead_id is sent raw/unhashed (not sensitive PII — it's just Meta's own
    // lead identifier), so show it in full rather than redacted.
    const rawLeadId = leadIdDigits(lead.metaLeadId);
    if (rawLeadId) {
      userDataPreview.lead_id = rawLeadId;
    }

    res.json({
      leadId: lead._id,
      name: lead.name ? `${lead.name.substring(0, 2)}...` : undefined,
      phoneAvailable: !!lead.phone,
      emailAvailable: !!lead.email,
      metaLeadId: lead.metaLeadId ? `${lead.metaLeadId.substring(0, 6)}...` : undefined,
      userData: userDataPreview,
      customData: {
        lead_event_source: "LeadTrace CRM",
        event_source: "crm",
        crm_stage: lead.stage,
        source: "leadtrace_crm",
        meta_lead_id: lead.metaLeadId || undefined,
        leadtrace_lead_id: lead._id,
        form_name: lead.formName || undefined,
        ad_name: lead.adName || undefined,
        ...(lead.stage === "Purchase" && typeof lead.dealValueEstimate === "number"
          ? { value: lead.dealValueEstimate, currency: lead.dealValueCurrency || "INR" }
          : {}),
      },
      fieldsPresent: Object.keys(userDataPreview),
      fieldsMissing: [
        ...(!lead.email ? ["em (email not available)"] : []),
        ...(!lead.phone ? ["ph (phone not available)"] : []),
        ...(!lead.name ? ["fn, ln (name not available)"] : []),
        ...(!rawLeadId ? ["lead_id (metaLeadId missing or non-numeric)"] : []),
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

export default router;