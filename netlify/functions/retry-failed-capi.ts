import type { Config } from "@netlify/functions";
import { getConvex } from "../../server/src/convexClient.js";
import { sendAndRecordCapiEvent } from "../../server/src/routes/meta.js";

// Retries CAPI events stuck in "failed" status, up to a small attempt cap, so
// transient failures (a momentary Meta API error, a network blip) don't sit
// there forever requiring someone to notice and click "Retry" on the Events
// page manually. Requires the same env vars as the api function.
const MAX_RETRY_ATTEMPTS = 5;

export default async () => {
  const failedEvents: any[] = await getConvex().query("crm:listEventsByStatus", { status: "failed" });
  const retryable = failedEvents.filter((e) => (e.attempts || 0) < MAX_RETRY_ATTEMPTS);

  if (retryable.length === 0) {
    console.log("[Retry] No failed events eligible for retry");
    return;
  }

  for (const event of retryable) {
    try {
      const result = await sendAndRecordCapiEvent(event._id);
      console.log(
        `[Retry] ${event.eventName} (${event.stage}) for lead ${event.metaLeadId}: ${
          result.success ? result.status : `still failing - ${result.error}`
        }`
      );
    } catch (err: any) {
      console.error(`[Retry] Error retrying ${event.eventName} (${event.stage}):`, err.message);
    }
  }
};

export const config: Config = {
  schedule: "0 */6 * * *", // every 6 hours
};
