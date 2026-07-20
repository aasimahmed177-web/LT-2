import serverless from "serverless-http";
import { createApp } from "../../server/src/app.js";

// Wraps the same Express app used by the standalone dev server
// (server/src/index.ts) so both deployment targets share one implementation.
export const handler = serverless(createApp());
