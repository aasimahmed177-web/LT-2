import { useState } from 'react';
import { mockLeads, getStatusColor, formatDate } from '../data/mockData';
import type { Lead, LeadStatus } from '../types';

const statuses: LeadStatus[] = ['new', 'contacted', 'pre-qualified', 'qualified', 'converted', 'not-qualified', 'junk'];

export default function Leads() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState(mockLeads);
  const [showStatusDropdown, setShowStatusDropdown] = useState<string | null>(null);

  const filteredLeads = leads.filter((lead) => {
    const q = search.toLowerCase();
    return (statusFilter === 'all' || lead.status === statusFilter) &&
      (!q || lead.name.toLowerCase().includes(q) || lead.email.toLowerCase().includes(q) || lead.id.toLowerCase().includes(q));
  });

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus, updatedAt: new Date().toISOString() } : l));
    setShowStatusDropdown(null);
  };

  const handleExport = () => {
    const csv = [
      ['ID', 'Name', 'Email', 'Status', 'Source'].join(','),
      ...filteredLeads.map(l => [l.id, l.name, l.email, l.status, l.source].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{filteredLeads.length} records &middot; syncing to Meta</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export
          </button>
          <button className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add lead
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card p-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              placeholder="Search leads..."
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors" aria-label="Clear search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 text-xs font-semibold rounded-md transition-all duration-150 ${
                statusFilter === 'all'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-ink-secondary hover:text-ink hover:bg-surface-container-low'
              }`}
            >
              All
            </button>
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all duration-150 capitalize ${
                  statusFilter === s
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-ink-secondary hover:text-ink hover:bg-surface-container-low'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-leads">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Source</th>
                <th>Interest</th>
                <th>Assigned</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-surface-container-low transition-colors duration-100">
                  <td>
                    <button onClick={() => setSelectedLead(lead)} className="font-semibold text-ink hover:text-primary transition-colors duration-150">
                      {lead.name}
                    </button>
                    <p className="text-xs text-ink-muted mt-1 font-mono">{lead.id}</p>
                  </td>
                  <td>
                    <p className="text-sm text-ink">{lead.email}</p>
                    <p className="text-xs text-ink-muted">{lead.phone}</p>
                  </td>
                  <td>
                    <div className="relative inline-block">
                      <button
                        onClick={() => setShowStatusDropdown(showStatusDropdown === lead.id ? null : lead.id)}
                        className={`badge ${getStatusColor(lead.status)} cursor-pointer transition-all duration-150`}
                      >
                        {lead.status}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${showStatusDropdown === lead.id ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      {showStatusDropdown === lead.id && (
                        <div
                          className="absolute z-20 mt-1 min-w-[160px] dropdown"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
                            {statuses.map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(lead.id, s)}
                                className={`w-full text-left px-3 py-1 text-xs font-medium flex items-center gap-2 hover:bg-surface-container-low transition-colors duration-100 capitalize ${
                                  lead.status === s ? 'text-ink' : 'text-ink-secondary'
                                }`}
                              >
                                <span className={`badge ${getStatusColor(s)}`}>{s}</span>
                                {lead.status === s && (
                                  <svg className="ml-auto" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="border-t border-border px-3 py-2">
                            <p className="text-xs text-ink-muted leading-relaxed">Status changes sent to Meta for optimization</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <p className="text-sm text-ink capitalize">{lead.source}</p>
                    <p className="text-xs text-ink-muted">{lead.formName}</p>
                  </td>
                  <td>
                    <p className="text-sm text-ink">{lead.propertyInterest || '—'}</p>
                    {lead.budget && <p className="text-xs text-ink-muted font-mono">{lead.budget}</p>}
                  </td>
                  <td>
                    <p className="text-sm text-ink">{lead.assignedTo || <span className="text-ink-muted">—</span>}</p>
                  </td>
                  <td>
                    <p className="text-xs text-ink-muted">{formatDate(lead.createdAt)}</p>
                  </td>
                  <td>
                    <button onClick={() => setSelectedLead(lead)} className="btn btn-ghost">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            </div>
            <p className="text-sm text-ink-muted font-medium">No leads match your filters</p>
            <button onClick={() => { setSearch(''); setStatusFilter('all'); }} className="text-xs text-primary font-semibold mt-2 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="bg-surface-background border border-border w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-bold text-ink">{selectedLead.name}</h2>
                <p className="text-xs text-ink-muted mt-1 font-mono">{selectedLead.id}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-container-low transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  { label: 'Email', value: selectedLead.email },
                  { label: 'Phone', value: selectedLead.phone },
                  { label: 'Status', value: selectedLead.status, badge: true },
                  { label: 'Source', value: selectedLead.source, capitalize: true },
                  { label: 'Form', value: selectedLead.formName },
                  { label: 'Ad', value: selectedLead.adName },
                  { label: 'Interest', value: selectedLead.propertyInterest || '—' },
                  { label: 'Budget', value: selectedLead.budget || '—' },
                ].map(({ label, value, badge, capitalize }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-ink-secondary">{label}</p>
                    {badge
                      ? <span className={`badge ${getStatusColor(value as string)} mt-1`}>{value}</span>
                      : <p className={`text-sm text-ink mt-0.5 ${capitalize ? 'capitalize' : ''}`}>{value}</p>
                    }
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-secondary mb-1">Notes</p>
                <p className="text-sm text-ink bg-surface-container-low rounded-lg px-3 py-3 leading-relaxed">{selectedLead.notes || 'No notes yet'}</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-xs text-ink-muted">
                  <p>Created {formatDate(selectedLead.createdAt)}</p>
                  <p className="mt-1">Updated {formatDate(selectedLead.updatedAt)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="relative w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-subtle"></span>
                    <span className="absolute inset-0 rounded-full bg-emerald-500 ring-2 ring-emerald-50"></span>
                  </span>
                  <span className="text-xs font-medium text-ink-secondary">Syncing to Meta</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}