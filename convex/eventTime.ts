// Meta lead creation-time handling.
//
// The initial "Lead" CAPI event should tell Meta when the person actually
// submitted the Instant Form — not when our sync happened to run. Those can be
// days apart (a daily cron, a first-ever sync of an existing form, a re-import),
// and using ingestion time misattributes the lead to the wrong moment.
//
// Only the "Lead" event uses this. Contact / QualifiedLead / ConversionLead /
// Purchase describe things that happened in the CRM, so they keep using the
// real stage-change time.

/**
 * Validates and normalizes a Meta `created_time` into an ISO-8601 string.
 * Returns undefined for anything unusable, so callers can fall through to the
 * next source rather than storing garbage.
 *
 * Meta sends offsets without a colon (e.g. "2026-07-21T13:36:44+0530"). That
 * parses in V8 but isn't guaranteed across runtimes, so the offset is
 * normalized to "+05:30" first to keep parsing deterministic.
 */
export function normalizeMetaCreatedTime(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const withColonOffset = trimmed.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const ms = Date.parse(withColonOffset);
  if (!Number.isFinite(ms)) return undefined;

  // Guard against clearly-bogus values: epoch-or-earlier, or a timestamp in the
  // future (bad data or clock skew). A small forward tolerance absorbs ordinary
  // clock drift between Meta and us.
  if (ms <= 0) return undefined;
  if (ms > Date.now() + 5 * 60 * 1000) return undefined;

  return new Date(ms).toISOString();
}

/**
 * Resolves the event_time (unix seconds) for a lead's initial "Lead" CAPI
 * event, in the documented order:
 *   1. the stored metaCreatedAt
 *   2. fullResponse.created_time (leads imported before metaCreatedAt existed)
 *   3. the supplied fallback — ingestion/current time
 */
export function resolveLeadEventTimeSeconds(
  metaCreatedAt: unknown,
  fullResponse: any,
  fallbackSeconds: number
): number {
  const stored = normalizeMetaCreatedTime(metaCreatedAt);
  if (stored) return Math.floor(Date.parse(stored) / 1000);

  const fromResponse = normalizeMetaCreatedTime(fullResponse?.created_time);
  if (fromResponse) return Math.floor(Date.parse(fromResponse) / 1000);

  return fallbackSeconds;
}
