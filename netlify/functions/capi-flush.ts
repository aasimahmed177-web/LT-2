import type { Config } from "@netlify/functions";
import { getConvex } from "../../server/src/convexClient.js";
import { sendPendingCapiEventsForLead, sendAndRecordCapiEvent } from "../../server/src/routes/meta.js";

// Safety net for CAPI delivery on serverless. Single stage changes send their
// events inline (awaited in the route), but bulk/CSV changes create many
// pending events that can't all be awaited within one function's timeout —
// and any send that was interrupted leaves an event "pending". This scheduled
// function flushes them:
//   - pending events  -> sent in funnel order per lead (with suppression)
//   - failed events   -> retried up to MAX_RETRY_ATTEMPTS
// Requires the same env vars as the api function.
const MAX_RETRY_ATTEMPTS = 5;
// Work is capped per run so a single invocation always finishes well inside the
// scheduled-function timeout. A large CSV import can queue hundreds of events
// at once; the remainder simply drains on subsequent runs.
const MAX_LEADS_PER_RUN = 15;
const MAX_RETRIES_PER_RUN = 20;

export default async () => {
  // 1. Flush pending events, grouped by lead so the funnel ladder sends in order.
  const pending: any[] = await getConvex().query("crm:listEventsByStatus", { status: "pending" });
  const allLeadIds = [...new Set(pending.map((e) => String(e.leadId)))];
  const leadIds = allLeadIds.slice(0, MAX_LEADS_PER_RUN);
  if (allLeadIds.length > leadIds.length) {
    console.log(`[CAPI flush] ${allLeadIds.length} lead(s) pending; processing ${leadIds.length} this run, rest next run`);
  }
  if (leadIds.length > 0) {
    console.log(`[CAPI flush] ${pending.length} pending event(s) across ${allLeadIds.length} lead(s)`);
    for (const leadId of leadIds) {
      const metaLeadId = pending.find((e) => String(e.leadId) === leadId)?.metaLeadId || leadId;
      try {
        await sendPendingCapiEventsForLead(metaLeadId, leadId);
      } catch (err: any) {
        console.error(`[CAPI flush] Error sending pending for lead ${leadId}:`, err.message);
      }
    }
  }

  // 2. Retry failed events under the attempt cap.
  const failed: any[] = await getConvex().query("crm:listEventsByStatus", { status: "failed" });
  const retryable = failed
    .filter((e) => (e.attempts || 0) < MAX_RETRY_ATTEMPTS)
    .slice(0, MAX_RETRIES_PER_RUN);
  if (retryable.length > 0) {
    console.log(`[CAPI flush] retrying ${retryable.length} failed event(s)`);
    for (const event of retryable) {
      try {
        await sendAndRecordCapiEvent(event._id);
      } catch (err: any) {
        console.error(`[CAPI flush] Error retrying ${event.eventName} (${event.stage}):`, err.message);
      }
    }
  }

  if (leadIds.length === 0 && retryable.length === 0) {
    console.log("[CAPI flush] nothing to send");
  }
};

export const config: Config = {
  schedule: "*/5 * * * *", // every 5 minutes — cheap when there's nothing pending
};
