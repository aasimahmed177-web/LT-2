// Thin re-export so existing call sites (server/src/routes/leads.ts,
// server/src/routes/csv.ts) don't need to change their import path.
//
// This used to contain its own implementation that sent events via an HTTP
// call to http://localhost:{PORT}/api/meta/send-capi-event — that only works
// on the standalone server (server/src/index.ts), where something is actually
// listening on that port. Inside a Netlify Function there's no such server to
// call, so the fetch would just fail (silently, since callers treat this as
// fire-and-forget), meaning CAPI events never actually sent in that
// deployment. sendPendingCapiEventsForLead() (in routes/meta.ts) calls the
// send logic directly, in-process, instead.
export { sendPendingCapiEventsForLead as triggerCapiAfterStageChange } from "./routes/meta.js";
