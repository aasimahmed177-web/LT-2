// Client registry — Convex-backed with in-memory fallback.
// After `npx convex deploy` + backfill, app uses Convex storage transparently.

import { getConvex } from "./convexClient.js";

export interface Client {
  id: string
  name: string
  slug: string
  status: "active" | "inactive"
  createdAt: string
}

export interface ClientMetaConfig {
  clientId: string
  pageId: string
  accessTokenConfigured: boolean
  pixelId?: string
  createdAt: string
}

export interface SyncRun {
  clientId: string
  startedAt: string
  finishedAt: string | null
  status: "running" | "completed" | "failed"
  formsScanned: number
  leadsFetched: number
  created: number
  updated: number
  skipped: number
  total: number
  perForm: any[]
  error?: string
}

// ─── In-Memory Store (fallback) ────────

const inMemoryClients = new Map<string, Client>()
const inMemoryMetaConfigs = new Map<string, ClientMetaConfig>()
const inMemorySyncRuns = new Map<string, SyncRun[]>()
const inMemoryLeadForms = new Map<string, any[]>()

let useConvexBackend = false
const convexIdMap = new Map<string, string>() // convexId -> logicalId
const logicalIdToConvex = new Map<string, string>() // logicalId -> convexId

const DEFAULT_CLIENT_ID = "default"

function initDefaultClient() {
  const pageId = process.env.META_PAGE_ID
  const tokenConfigured = !!(process.env.META_ACCESS_TOKEN && pageId)
  inMemoryClients.set(DEFAULT_CLIENT_ID, {
    id: DEFAULT_CLIENT_ID, name: "Default Meta Client",
    slug: "default-meta-client", status: "active",
    createdAt: new Date().toISOString(),
  })
  inMemoryMetaConfigs.set(DEFAULT_CLIENT_ID, {
    clientId: DEFAULT_CLIENT_ID, pageId: pageId || "",
    accessTokenConfigured: tokenConfigured,
    createdAt: new Date().toISOString(),
  })
  inMemorySyncRuns.set(DEFAULT_CLIENT_ID, [])
  inMemoryLeadForms.set(DEFAULT_CLIENT_ID, [])
}
initDefaultClient()

// ─── Convex Detection ────────────────

export async function checkDeployStatus(): Promise<{ available: boolean; reason?: string }> {
  try {
    const convex = getConvex()
    await convex.query("clients:list")
    useConvexBackend = true
    return { available: true }
  } catch (err: any) {
    useConvexBackend = false
    return { available: false, reason: err.message }
  }
}

async function syncFromConvex(): Promise<void> {
  if (!useConvexBackend) return
  try {
    const convex = getConvex()
    const convexClients: any[] = await convex.query("clients:list")
    // Map the "default" logical ID to the first active Convex client
    if (convexClients.length > 0) {
      const firstClient = convexClients[0]
      logicalIdToConvex.set(DEFAULT_CLIENT_ID, firstClient._id)
    }
    for (const c of convexClients) {
      const logicalId = c._id
      convexIdMap.set(logicalId, logicalId)
      logicalIdToConvex.set(logicalId, logicalId)
      // Replace in-memory default if its slug matches
      if (c.slug === "default-meta-client") {
        inMemoryClients.set(DEFAULT_CLIENT_ID, { id: DEFAULT_CLIENT_ID, name: c.name, slug: c.slug, status: c.status, createdAt: c.createdAt })
      }
      if (!inMemoryClients.has(logicalId)) {
        inMemoryClients.set(logicalId, { id: logicalId, name: c.name, slug: c.slug, status: c.status, createdAt: c.createdAt })
      }
      try {
        const config = await convex.query("clients:getMetaConfig", { clientId: logicalId })
        if (config) inMemoryMetaConfigs.set(logicalId, { clientId: logicalId, pageId: config.pageId || "", accessTokenConfigured: config.accessTokenConfigured, pixelId: config.pixelId, createdAt: config.createdAt })
      } catch { /* no config yet */ }
      try {
        const forms = await convex.query("clients:listLeadForms", { clientId: logicalId })
        if (forms) inMemoryLeadForms.set(logicalId, forms.map((f: any) => ({ id: f.formId, formId: f.formId, name: f.formName, formName: f.formName, status: f.status })))
      } catch { /* no forms yet */ }
      try {
        const lastRun = await convex.query("clients:getLastSyncRun", { clientId: logicalId })
        if (lastRun) {
          const runs = inMemorySyncRuns.get(logicalId) || []
          runs.unshift({ clientId: logicalId, startedAt: lastRun.startedAt, finishedAt: lastRun.finishedAt || null, status: lastRun.status, formsScanned: lastRun.formsScanned, leadsFetched: lastRun.leadsFetched, created: lastRun.created, updated: lastRun.updated, skipped: lastRun.skipped, total: lastRun.total, perForm: lastRun.perForm || [], error: lastRun.error })
          inMemorySyncRuns.set(logicalId, runs)
        }
      } catch { /* no sync runs yet */ }
    }
  } catch (err) {
    console.error("Failed to sync from Convex:", err)
    useConvexBackend = false
  }
}

// ─── Auto-backfill Meta config on startup ────────

export async function autoBackfillMetaConfig(): Promise<void> {
  try {
    const convex = getConvex()
    await convex.query("clients:list") // test connection
    useConvexBackend = true
    await syncFromConvex()

    const clients = getClients()
    if (clients.length === 0) return

    const id = resolveConvexClientId(clients[0].id)
    const pageId = process.env.META_PAGE_ID || ""
    const tokenConfigured = !!(process.env.META_ACCESS_TOKEN && pageId)

    // Fetch Meta page name for client display name
    let pageName: string | undefined;
    const metaToken = process.env.META_ACCESS_TOKEN;
    if (metaToken && pageId) {
      try {
        const pageRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=name&access_token=${metaToken}`);
        const pageData: any = await pageRes.json();
        if (pageData.name) pageName = pageData.name;
      } catch { /* page name fetch is best-effort */ }
    }

    // Update client name if page name is available
    if (pageName) {
      try {
        await convex.mutation("clients:updateName", { id, name: pageName });
      } catch { /* name update is best-effort */ }
    }

    await convex.mutation("clients:upsertMetaConfig", {
      clientId: id,
      pageId,
      accessTokenConfigured: tokenConfigured,
      pixelId: process.env.META_PIXEL_ID || undefined,
    })
    console.log(`Auto-backfilled Meta config for client ${id}: pageId=${pageId ? "set" : "unset"} tokenConfigured=${tokenConfigured}`)
    await syncFromConvex()
  } catch (err: any) {
    console.log("Auto-backfill skipped (Convex not ready):", err.message)
  }
}

// ─── Getters ────────────────────────

export function getClients(): Client[] {
  const all = Array.from(inMemoryClients.values())
  if (!useConvexBackend) return all
  // Deduplicate: if there's a Convex client for "default-meta-client", only return the Convex-backed entry
  const seen = new Set<string>()
  return all.filter((c) => {
    const key = c.slug
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getClient(id: string): Client | undefined {
  return inMemoryClients.get(id) || inMemoryClients.get(DEFAULT_CLIENT_ID)
}

export function getDefaultClientId(): string { return DEFAULT_CLIENT_ID }

export function resolveClientId(clientId?: string): string {
  if (!clientId) return DEFAULT_CLIENT_ID
  if (inMemoryClients.has(clientId)) return clientId
  const convexId = logicalIdToConvex.get(clientId)
  if (convexId) return convexId
  return DEFAULT_CLIENT_ID
}

/** Resolve a client's logical ID to its Convex document ID (when backend is active). */
export function resolveConvexClientId(clientId: string): string {
  if (useConvexBackend) {
    const mapped = logicalIdToConvex.get(clientId)
    if (mapped) return mapped
  }
  return clientId
}

export function getClientMetaConfig(clientId: string): ClientMetaConfig | undefined {
  return inMemoryMetaConfigs.get(resolveClientId(clientId))
}

export function isConvexBackend(): boolean { return useConvexBackend }

// ─── Sync Runs ──────────────────────

export function startSyncRun(clientId: string): string {
  const id = resolveClientId(clientId)
  const run: SyncRun = { clientId: id, startedAt: new Date().toISOString(), finishedAt: null, status: "running", formsScanned: 0, leadsFetched: 0, created: 0, updated: 0, skipped: 0, total: 0, perForm: [] }
  const runs = inMemorySyncRuns.get(id) || []
  runs.unshift(run)
  inMemorySyncRuns.set(id, runs)
  return id
}

export function completeSyncRun(clientId: string, data: { formsScanned: number; leadsFetched: number; created: number; updated: number; skipped: number; total: number; perForm: any[] }) {
  const id = resolveClientId(clientId)
  const runs = inMemorySyncRuns.get(id) || []
  const current = runs[0]
  if (current) {
    current.finishedAt = new Date().toISOString()
    current.status = "completed"
    Object.assign(current, data)
  }
}

export function failSyncRun(clientId: string, error: string) {
  const id = resolveClientId(clientId)
  const runs = inMemorySyncRuns.get(id) || []
  const current = runs[0]
  if (current) { current.finishedAt = new Date().toISOString(); current.status = "failed"; current.error = error }
}

export function getLastSyncRun(clientId: string): SyncRun | null {
  const id = resolveClientId(clientId)
  const runs = inMemorySyncRuns.get(id) || []
  return runs[0] || null
}

// ─── Lead Forms ──────────────────────

export function setClientLeadForms(clientId: string, forms: any[]) {
  inMemoryLeadForms.set(resolveClientId(clientId), forms)
}

export function getClientLeadForms(clientId: string): any[] {
  return inMemoryLeadForms.get(resolveClientId(clientId)) || []
}

// ─── Env values ─────────────────────

export function getDefaultMetaToken(): string | undefined { return process.env.META_ACCESS_TOKEN }
export function getDefaultPageId(): string | undefined { return process.env.META_PAGE_ID }

// ─── Backfill ────────────────────────

export async function backfillDefaultClient(): Promise<{ success: boolean; clientId?: string; leadsAssigned?: number; error?: string }> {
  try {
    const convex = getConvex()
    // Check if client already exists
    let existingClient: any;
    try {
      existingClient = await convex.query("clients:getBySlug", { slug: "default-meta-client" })
    } catch { /* query not available yet */ }

    // Try to fetch Meta page name for client display name
    let pageName = "Default Meta Client";
    const metaToken = process.env.META_ACCESS_TOKEN;
    const metaPageId = process.env.META_PAGE_ID;
    if (metaToken && metaPageId) {
      try {
        const pageRes = await fetch(`https://graph.facebook.com/v21.0/${metaPageId}?fields=name&access_token=${metaToken}`);
        const pageData: any = await pageRes.json();
        if (pageData.name) {
          pageName = pageData.name;
        }
      } catch { /* page name fetch is best-effort */ }
    }

    let clientId: string;
    if (existingClient) {
      clientId = existingClient._id;
      // Update client name if page name is available
      if (pageName !== "Default Meta Client") {
        await convex.mutation("clients:updateName", { id: clientId, name: pageName });
      }
      console.log("Using existing client:", clientId);
    } else {
      clientId = await convex.mutation("clients:create", { name: pageName, slug: "default-meta-client", status: "active" })
    }

    const pageId = metaPageId || ""
    const tokenConfigured = !!(metaToken && pageId)
    await convex.mutation("clients:upsertMetaConfig", { clientId, pageId, accessTokenConfigured: tokenConfigured, pixelId: process.env.META_PIXEL_ID || undefined })
    const assignResult: { assigned: number } = await convex.mutation("leads:assignToClient", { clientId })
    useConvexBackend = true
    await syncFromConvex()
    return { success: true, clientId, leadsAssigned: assignResult.assigned }
  } catch (err: any) {
    console.error("Backfill error:", err)
    return { success: false, error: err.message }
  }
}