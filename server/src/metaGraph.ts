// Single source of truth for Meta Graph API URLs.
//
// The version was previously hardcoded as "v21.0" in eight separate call sites
// across clients.ts and routes/meta.ts, which meant a version bump had to be
// applied by hand in every one of them (and a missed site would silently keep
// calling an older, eventually-deprecated version). Everything now routes
// through graphApiUrl() so the version is configured once.
//
// Override with META_GRAPH_API_VERSION (non-secret). Read at call time rather
// than module load so serverless functions pick up env changes without a cold
// rebuild.

const DEFAULT_META_GRAPH_API_VERSION = "v26.0";

export function getMetaGraphApiVersion(): string {
  const raw = (process.env.META_GRAPH_API_VERSION || "").trim();
  // Only accept a well-formed "vNN.N" value — a typo'd or empty env var falls
  // back to the default rather than producing a URL Meta will reject.
  return /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_META_GRAPH_API_VERSION;
}

/**
 * Builds a Graph API URL at the configured version.
 * `path` is the part after the version, e.g. "123456/leads".
 * Undefined/empty params are omitted.
 */
export function graphApiUrl(
  path: string,
  params: Record<string, string | number | undefined | null> = {}
): string {
  const cleanPath = String(path).replace(/^\/+/, "");
  const url = new URL(`https://graph.facebook.com/${getMetaGraphApiVersion()}/${cleanPath}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Strips access tokens out of any string before it reaches a log line or an
 * API response. Graph API URLs carry the token as a query parameter, so any
 * code path that echoes a URL (or a Meta error message quoting one) would
 * otherwise leak it.
 */
export function redactToken(text: string): string {
  if (!text) return text;
  return String(text).replace(/(access_token=)[^&\s"']+/gi, "$1[REDACTED]");
}
