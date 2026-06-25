const API_BASE = '/api'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

function withClient(url: string, clientId?: string): string {
  return clientId ? `${url}${url.includes('?') ? '&' : '?'}clientId=${encodeURIComponent(clientId)}` : url
}

export function getClients() {
  return json<{ clients: any[]; convexBackend: boolean }>(`${API_BASE}/clients`)
}

export function getClient(id: string) {
  return json<any>(`${API_BASE}/clients/${id}`)
}

export function getHealth(clientId?: string) {
  return json<{ status: string; metaConfigured: boolean; pageId: string | null }>(withClient(`${API_BASE}/meta/health`, clientId))
}

export function importLeads(clientId?: string) {
  return json<any>(withClient(`${API_BASE}/meta/import-leads`, clientId), { method: 'POST' })
}

export function getLeads(clientId?: string) {
  return json<{ leads: any[] }>(withClient(`${API_BASE}/leads`, clientId))
}

export function getSourceOfTruth(clientId?: string) {
  return json<any>(withClient(`${API_BASE}/debug/source-of-truth`, clientId))
}

export function searchLeads(q: string, clientId?: string) {
  return json<{ leads: any[] }>(withClient(`${API_BASE}/leads/search?q=${encodeURIComponent(q)}`, clientId))
}

export function getLead(id: string) {
  return json<any>(`${API_BASE}/leads/${id}`)
}

export function updateLeadStage(id: string, stage: string, reason?: string) {
  return json<any>(`${API_BASE}/leads/${id}/stage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, reason }),
  })
}

export function getLeadHistory(id: string) {
  return json<any>(`${API_BASE}/leads/${id}/history`)
}

export function getLeadNotes(id: string) {
  return json<any>(`${API_BASE}/leads/${id}/notes`)
}

export function addLeadNote(id: string, content: string) {
  return json<any>(`${API_BASE}/leads/${id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export function getLeadTasks(id: string) {
  return json<any>(`${API_BASE}/leads/${id}/tasks`)
}

export function addLeadTask(id: string, content: string, dueDate?: string) {
  return json<any>(`${API_BASE}/leads/${id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, dueDate }),
  })
}

export function toggleLeadTask(id: string, taskId: string, done: boolean) {
  return json<any>(`${API_BASE}/leads/${id}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  })
}

export function getStats(clientId?: string) {
  return json<any>(withClient(`${API_BASE}/stats`, clientId))
}

export function getEvents(clientId?: string) {
  return json<any>(withClient(`${API_BASE}/events`, clientId))
}

export function getEventsCounts(clientId?: string) {
  return json<any>(withClient(`${API_BASE}/events/counts`, clientId))
}

export function getLastImportResult(clientId?: string) {
  return json<any>(withClient(`${API_BASE}/meta/last-import-result`, clientId))
}

export function getLeadEvents(id: string) {
  return json<any>(`${API_BASE}/leads/${id}/events`)
}

export function createClient(name: string, pageId?: string, pixelId?: string) {
  return json<any>(`${API_BASE}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, pageId, pixelId }),
  })
}

export function updateClientConfig(id: string, data: { name?: string; pageId?: string; pixelId?: string }) {
  return json<any>(`${API_BASE}/clients/${id}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}