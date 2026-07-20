import type { Config } from "@netlify/functions";
import { runImportForAllClients } from "../../server/src/routes/meta.js";

// Replaces the standalone server's setInterval auto-sync loop for the Netlify
// deployment: serverless functions don't persist a setInterval across
// invocations, so real-time-ish lead ingestion instead runs on this cron.
// Requires the same env vars as the api function (META_ACCESS_TOKEN,
// META_PAGE_ID, CONVEX_URL, etc.) to be set in the Netlify site's env config.
export default async () => {
  const results = await runImportForAllClients();
  for (const r of results) {
    if (r.error) {
      console.error(`[Scheduled sync] Failed for ${r.clientName || r.clientId}: ${r.error}`);
    } else {
      console.log(`[Scheduled sync] ${r.clientName || r.clientId}: ${r.result.created} created, ${r.result.updated} updated`);
    }
  }
};

export const config: Config = {
  schedule: "*/10 * * * *",
};
