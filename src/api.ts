const API_BASE = '/api'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export function getHealth() {
  return json<{ status: string; metaConfigured: boolean; pageId: string | null }>(`${API_BASE}/meta/health`)
}

export function importLeads() {
  return json<any>(`${API_BASE}/meta/import-leads`, { method: 'POST' })
}

export function getLeads() {
  return json<{ leads: any[] }>(`${API_BASE}/leads`)
}

export function getSourceOfTruth() {
  return json<any>(`${API_BASE}/debug/source-of-truth`)
}

export function searchLeads(q: string) {
  return json<{ leads: any[] }>(`${API_BASE}/leads/search?q=${encodeURIComponent(q)}`)
}

export function getLead(id: string) {
  return json<any>(`${API_BASE}/leads/${id}`)
}

export function updateLeadStage(id: string, stage: string) {
  return json<any>(`${API_BASE}/leads/${id}/stage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
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

export function addLeadTask(id: string, content: string) {
  return json<any>(`${API_BASE}/leads/${id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export function toggleLeadTask(id: string, taskId: string, done: boolean) {
  return json<any>(`${API_BASE}/leads/${id}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  })
}

export function getStats() {
  return json<any>(`${API_BASE}/stats`)
}

export function getEvents() {
  return json<any>(`${API_BASE}/events`)
}

export function getEventsCounts() {
  return json<any>(`${API_BASE}/events/counts`)
}