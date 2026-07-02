import { getConvex } from "./convexClient.js";

// Stage hierarchy for final-stage-only suppression (must match convex/crm.ts)
export const STAGE_HIERARCHY: Record<string, number> = {
  Lead: 0,
  Contact: 1,
  Prospect: 2,
  ConversionLead: 3,
  Purchase: 4,
};

// CAPI: fire-and-forget send of the most recent pending event for a lead
export async function triggerCapiAfterStageChange(leadId: string, convexLeadId: string) {
  try {
    // Find the most recent pending CAPI event for this lead
    const events: any[] = await getConvex().query("crm:listEventsByLead", { leadId: convexLeadId as any });
    const pendingEvent = events.find((e: any) => e.status === "pending" && e.eventId);
    if (!pendingEvent) return; // No CAPI event to send

    // Final-stage-only check: if a higher-stage event has already been sent, suppress this one
    const pendingScore = STAGE_HIERARCHY[pendingEvent.stage] ?? -1;
    const hasHigherSent = events.some((e: any) =>
      e.status === "sent" && (STAGE_HIERARCHY[e.stage] ?? -1) > pendingScore
    );
    if (hasHigherSent) {
      console.log(`[CAPI] Suppressing ${pendingEvent.eventName} (${pendingEvent.stage}) for lead ${leadId}: higher-stage event already sent`);
      await getConvex().mutation("crm:updateCapiEventStatus", {
        eventId: pendingEvent._id as any,
        status: "suppressed",
        response: `Superseded by higher-stage event`,
      });
      return;
    }

    // Call the CAPI send endpoint internally
    const pixelId = process.env.META_PIXEL_ID;
    const metaToken = process.env.META_ACCESS_TOKEN;

    if (!pixelId || !metaToken) {
      // Mark as skipped if CAPI not configured
      console.log(`[CAPI] Skipping event ${pendingEvent.eventId}: CAPI not configured (pixel=${!!pixelId}, token=${!!metaToken})`);
      return;
    }

    // Send the event via the helper
    const url = `http://localhost:${process.env.PORT || "3001"}/api/meta/send-capi-event`;
    const capiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: pendingEvent._id }),
    });
    const capiData: any = await capiRes.json();
    if (capiData.success) {
      console.log(`[CAPI] Event ${pendingEvent.eventName} sent for lead ${leadId}: ${capiData.status}`);
    } else {
      console.log(`[CAPI] Event ${pendingEvent.eventName} failed for lead ${leadId}: ${capiData.error}`);
    }
  } catch (err: any) {
    // Never let CAPI failure bubble up
    console.error("[CAPI] Async send error:", err.message);
  }
}