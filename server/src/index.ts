import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { autoBackfillMetaConfig } from "./clients.js";
import { runImportForAllClients } from "./routes/meta.js";

// Standalone always-on server entrypoint (e.g. `npm run server`, a VPS,
// Render, Railway). Not used by the Netlify deployment — see
// netlify/functions/api.ts for that, which reuses the same createApp().

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../../dist");

const app = createApp();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Serve the built frontend for all non-API routes (SPA). Only relevant when
// running as a standalone server — Netlify serves the built frontend itself.
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`LeadTrace API running on port ${PORT}`);
  // Auto-backfill Meta config on startup (async, non-blocking)
  autoBackfillMetaConfig();

  // Auto-sync Meta leads on an interval (standalone-server only; the Netlify
  // deployment uses a Scheduled Function instead, since setInterval doesn't
  // survive across serverless invocations).
  const AUTO_SYNC_INTERVAL = parseInt(process.env.AUTO_SYNC_INTERVAL || "600000", 10);
  if (AUTO_SYNC_INTERVAL > 0) {
    console.log(`[Auto-sync] Scheduling Meta lead import every ${AUTO_SYNC_INTERVAL / 60000} minutes`);
    setInterval(async () => {
      try {
        const results = await runImportForAllClients();
        for (const r of results) {
          if (r.error) {
            console.error(`[Auto-sync] Failed for ${r.clientName || r.clientId}: ${r.error}`);
          } else {
            console.log(`[Auto-sync] Imported leads for ${r.clientName || r.clientId}: ${r.result.created} created, ${r.result.updated} updated`);
          }
        }
      } catch (err: any) {
        console.error("[Auto-sync] Error:", err.message);
      }
    }, AUTO_SYNC_INTERVAL);
  }
});
