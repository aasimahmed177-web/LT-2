import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";
import { getClients, getClientMetaConfig, resolveClientId } from "../clients.js";

const router = Router();

// GET /api/system/health — comprehensive system health for the Settings dashboard
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const clientId = resolveClientId(_req.query.clientId as string);

    // Env config
    const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || null;
    const metaPageId = process.env.META_PAGE_ID || null;
    const metaPixelId = process.env.META_PIXEL_ID || null;
    const metaAccessToken = process.env.META_ACCESS_TOKEN || null;
    const metaTestEventCode = process.env.META_TEST_EVENT_CODE || null;
    const dryRun = process.env.META_CAPI_DRY_RUN !== "false";

    // Client info
    const clients = getClients();
    const client = clients.find((c: any) => c.id === clientId) || null;
    const clientConfig = client ? getClientMetaConfig(clientId) : null;

    // Convex stats
    let totalLeads = 0;
    let lastSentEvent: any = null;
    let lastFailedEvent: any = null;
    let eventCountsData: any = null;

    try {
      const convex = getConvex();
      const [stats, counts, allEvents] = await Promise.all([
        convex.query("crm:getStats"),
        convex.query("crm:eventsCounts"),
        convex.query("crm:listEvents"),
      ]);
      totalLeads = stats?.total || 0;
      eventCountsData = counts || null;

      // Find last sent event
      const sentEvents = (allEvents as any[]).filter((e) => e.status === "sent");
      if (sentEvents.length > 0) {
        sentEvents.sort((a, b) => {
          const atA = a.lastAttemptAt || a.createdAt || "";
          const atB = b.lastAttemptAt || b.createdAt || "";
          return atB.localeCompare(atA);
        });
        lastSentEvent = {
          time: sentEvents[0].lastAttemptAt || sentEvents[0].createdAt,
          eventName: sentEvents[0].eventName,
          leadName: sentEvents[0].leadName,
        };
      }

      // Find last failed event
      const failedEvents = (allEvents as any[]).filter((e) => e.status === "failed");
      if (failedEvents.length > 0) {
        failedEvents.sort((a, b) => {
          const atA = a.lastAttemptAt || a.createdAt || "";
          const atB = b.lastAttemptAt || b.createdAt || "";
          return atB.localeCompare(atA);
        });
        lastFailedEvent = {
          time: failedEvents[0].lastAttemptAt || failedEvents[0].createdAt,
          eventName: failedEvents[0].eventName,
          error: failedEvents[0].error,
          leadName: failedEvents[0].leadName,
        };
      }
    } catch (e) {
      // Convex may not be available; return partial data
    }

    res.json({
      convex: {
        configured: !!convexUrl,
        url: convexUrl ? convexUrl.substring(0, 20) + "..." : null,
      },
      meta: {
        pageIdConfigured: !!metaPageId,
        pageId: metaPageId ? metaPageId.substring(0, 5) + "..." : null,
        pixelIdConfigured: !!metaPixelId,
        pixelId: metaPixelId ? metaPixelId.substring(0, 4) + "..." : null,
        accessTokenConfigured: !!metaAccessToken,
        accessTokenPreview: metaAccessToken ? metaAccessToken.substring(0, 6) + "..." : null,
        testEventCodeConfigured: !!metaTestEventCode,
      },
      capi: {
        dryRun,
        liveSendingEnabled: !dryRun && !!metaAccessToken && !!metaPixelId,
      },
      client: {
        id: clientId,
        name: client?.name || clientId,
        pageIdConfigured: clientConfig?.pageId ? true : false,
        pixelIdConfigured: clientConfig?.pixelId ? true : false,
      },
      leads: {
        totalReal: totalLeads,
      },
      events: eventCountsData ? {
        pending: eventCountsData.pending,
        sent: eventCountsData.sent,
        failed: eventCountsData.failed,
        skipped: eventCountsData.skipped,
        cancelled: eventCountsData.cancelled,
        suppressed: eventCountsData.suppressed,
        dryRun: eventCountsData.dry_run,
        total: eventCountsData.total,
      } : null,
      lastSentEvent,
      lastFailedEvent,
    });
  } catch (err: any) {
    console.error("System health error:", err.message);
    res.status(500).json({ error: "Failed to fetch system health" });
  }
});

export default router;