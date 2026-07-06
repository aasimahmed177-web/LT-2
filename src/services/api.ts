const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Leads ───
export interface LeadsResponse {
  leads: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function fetchLeads(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.status && params.status !== 'all') q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return request<LeadsResponse>(`/leads${qs ? `?${qs}` : ''}`);
}

export function fetchLead(id: string) {
  return request<any>(`/leads/${id}`);
}

export function createLead(data: { name: string; email: string; phone: string; source?: string; form_name?: string; ad_name?: string; notes?: string }) {
  return request<any>('/leads', { method: 'POST', body: JSON.stringify(data) });
}

export function updateLead(id: string, data: Record<string, any>) {
  return request<any>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function updateLeadStatus(id: string, status: string) {
  return request<any>(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function deleteLead(id: string) {
  return request<any>(`/leads/${id}`, { method: 'DELETE' });
}

// ─── Stats ───
export interface DashboardStats {
  totalLeads: number;
  newToday: number;
  qualified: number;
  converted: number;
  conversionRate: number;
}

export interface WeeklyDataPoint {
  day: string;
  leads: number;
  qualified: number;
  converted: number;
}

export function fetchStats() {
  return request<DashboardStats>('/stats');
}

export function fetchWeeklyData() {
  return request<WeeklyDataPoint[]>('/stats/weekly');
}

// ─── Setup / Settings ───
export function fetchMetaConnection() {
  return request<any>('/setup/meta');
}

export function saveMetaConnection(data: { pixelId: string; accessToken: string; facebookPageId: string }) {
  return request<any>('/setup/meta', { method: 'PUT', body: JSON.stringify(data) });
}

export function testMetaConnection() {
  return request<{ success: boolean; error?: string }>('/setup/meta/test', { method: 'POST' });
}

export function fetchLeadForms() {
  return request<any[]>('/setup/forms');
}

export function saveLeadForms(data: any[]) {
  return request<any[]>('/setup/forms', { method: 'PUT', body: JSON.stringify(data) });
}

export function syncLeadForms() {
  return request<{ success: boolean; formsSynced: number; leadsImported: number; errors: string[] }>('/setup/forms/sync', { method: 'POST' });
}

export function fetchTeamMembers() {
  return request<any[]>('/setup/team');
}

export function saveTeamMembers(data: any[]) {
  return request<any[]>('/setup/team', { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchAssignmentRules() {
  return request<any[]>('/setup/rules');
}

export function saveAssignmentRules(data: any[]) {
  return request<any[]>('/setup/rules', { method: 'PUT', body: JSON.stringify(data) });
}

// ─── Status color utility (kept from mockData) ───
export function getStatusColor(status: string): string {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800';
    case 'contacted': return 'bg-yellow-100 text-yellow-800';
    case 'pre-qualified': return 'bg-purple-100 text-purple-800';
    case 'qualified': return 'bg-green-100 text-green-800';
    case 'converted': return 'bg-emerald-100 text-emerald-800';
    case 'not-qualified': return 'bg-orange-100 text-orange-800';
    case 'junk': return 'bg-red-100 text-red-800';
    default: return 'bg-slate-100 text-slate-800';
  }
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}