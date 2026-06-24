import { ConvexHttpClient } from "convex/browser";

let _client: ConvexHttpClient | null = null;

function getConvexUrl(): string | null {
  return process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || null;
}

export function getConvex(): ConvexHttpClient {
  const url = getConvexUrl();
  if (!url) {
    throw new Error("CONVEX_URL or VITE_CONVEX_URL environment variable is required");
  }
  if (!_client) {
    _client = new ConvexHttpClient(url);
  }
  return _client;
}