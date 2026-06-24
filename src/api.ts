const API_BASE = '/api'

export async function getHealth() {
  const res = await fetch(`${API_BASE}/meta/health`)
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json()
}

export async function importLeads() {
  const res = await fetch(`${API_BASE}/meta/import-leads`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Import failed: ${res.status}`)
  }
  return res.json()
}

export async function getLeads() {
  const res = await fetch(`${API_BASE}/leads`)
  if (!res.ok) throw new Error(`Fetch leads failed: ${res.status}`)
  return res.json()
}

export async function getSourceOfTruth() {
  const res = await fetch(`${API_BASE}/debug/source-of-truth`)
  if (!res.ok) throw new Error(`Source of truth failed: ${res.status}`)
  return res.json()
}