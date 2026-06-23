import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import LeadDrawer from '../components/LeadDrawer';
import type { Id } from '../../convex/_generated/dataModel';

const STAGES = ['Lead', 'Contact', 'Prospect', 'ConversionLead', 'Purchase', 'NotQualified', 'NoResponse', 'Duplicate', 'Invalid'];
const STAGE_COLORS: Record<string, string> = {
  Lead: 'bg-slate-100 text-slate-700',
  Contact: 'bg-blue-100 text-blue-700',
  Prospect: 'bg-purple-100 text-purple-700',
  ConversionLead: 'bg-amber-100 text-amber-700',
  Purchase: 'bg-emerald-100 text-emerald-700',
  NotQualified: 'bg-orange-100 text-orange-700',
  NoResponse: 'bg-red-100 text-red-700',
  Duplicate: 'bg-pink-100 text-pink-700',
  Invalid: 'bg-gray-100 text-gray-500',
};

function SyncBadge({ status }: { status?: string }) {
  if (!status || status === 'not_sent') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">Not sent</span>;
  }
  if (status === 'pending') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Pending</span>;
  }
  if (status === 'sent') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Sent</span>;
  }
  return null;
}

function StagePill({ stage }: { stage: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md ${STAGE_COLORS[stage] || 'bg-slate-100 text-slate-700'}`}>
      {stage}
    </span>
  );
}

function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getBudgetRange(answers?: Record<string, string>): string {
  if (!answers) return '—';
  return answers['What budget range are you considering?'] || answers.Budget || '—';
}

function getPurpose(answers?: Record<string, string>): string {
  if (!answers) return '—';
  return answers['Why are you exploring Dubai property?'] || answers.Purpose || '—';
}

export default function Leads() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(null);

  const leads = useQuery(api.leads.listLeads, {
    search: search || undefined,
    stage: stageFilter || undefined,
  });

  const handleExport = () => {
    if (!leads) return;
    const headers = ['Name', 'Phone', 'Email', 'Stage', 'Campaign', 'Ad', 'Form', 'Budget', 'Purpose', 'Meta Lead ID', 'Sync Status', 'Created'];
    const rows = leads.map(l =>
      [l.fullName, l.phoneNumber || '', l.email || '', l.currentStage, l.campaignName || '', l.adName || '', l.formName || '', getBudgetRange(l.answers), getPurpose(l.answers), l.metaLeadId || '', l.syncStatus || '', formatDate(l.createdAt)].map(v => `"${v}"`).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-full fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Leads</h1>
          <p className="text-xs font-medium text-ink-secondary mt-0.5">{leads ? `${leads.length} records` : 'Loading...'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-border rounded-xl p-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              placeholder="Search name, phone, Meta Lead ID..."
              className="w-full text-sm text-ink bg-white border border-border rounded-lg pl-9 pr-8 py-1.5 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] transition-all duration-150"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setStageFilter('')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 ${
                !stageFilter ? 'bg-primary text-white shadow-sm' : 'text-ink-secondary hover:text-ink hover:bg-surface-container-low'
              }`}
            >
              All Stages
            </button>
            {STAGES.map(s => (
              <button
                key={s}
                onClick={() => setStageFilter(stageFilter === s ? '' : s)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 ${
                  stageFilter === s ? 'bg-primary text-white shadow-sm' : 'text-ink-secondary hover:text-ink hover:bg-surface-container-low'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Name</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Phone</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Budget</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Purpose</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Stage</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Campaign</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Ad</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Created</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Sync</th>
                <th className="w-8 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {!leads ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-border-subtle animate-pulse" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-surface-container-high shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 bg-surface-container-high rounded" />
                          <div className="h-2.5 w-20 bg-surface-container-high rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><div className="h-3 w-24 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-16 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-20 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-5 w-14 bg-surface-container-high rounded-full" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-20 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-20 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-20 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-4 w-16 bg-surface-container-high rounded-full" /></td>
                    <td className="px-3 py-2.5"><div className="h-4 w-4 bg-surface-container-high rounded" /></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center mx-auto mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                    </div>
                    <p className="text-sm text-ink-muted font-medium">No leads found</p>
                    {(search || stageFilter) && (
                      <button onClick={() => { setSearch(''); setStageFilter(''); }} className="text-xs text-primary font-semibold mt-2 hover:underline">Clear filters</button>
                    )}
                  </td>
                </tr>
              ) : leads.map((lead) => (
                <tr
                  key={lead._id}
                  className="border-b border-border-subtle hover:bg-surface-container-low transition-colors duration-100 cursor-pointer"
                  onClick={() => setSelectedLeadId(lead._id as Id<"leads">)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-fixed to-primary-fixed-dim flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">
                          {lead.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink leading-tight truncate max-w-[160px]">{lead.fullName}</p>
                        {lead.metaLeadId && <p className="text-[10px] text-ink-muted font-mono truncate max-w-[160px]">ID: {lead.metaLeadId}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-sm text-ink font-mono">{lead.phoneNumber || <span className="text-ink-muted">—</span>}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-sm text-ink">{getBudgetRange(lead.answers)}</p>
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px]">
                    <p className="text-sm text-ink truncate">{getPurpose(lead.answers)}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <StagePill stage={lead.currentStage} />
                  </td>
                  <td className="px-3 py-2.5 max-w-[140px]">
                    <p className="text-sm text-ink truncate" title={lead.campaignName}>{lead.campaignName || <span className="text-ink-muted">—</span>}</p>
                  </td>
                  <td className="px-3 py-2.5 max-w-[140px]">
                    <p className="text-sm text-ink truncate" title={lead.adName}>{lead.adName || <span className="text-ink-muted">—</span>}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-[11px] text-ink-muted whitespace-nowrap">{formatDate(lead.createdAt)}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <SyncBadge status={lead.syncStatus} />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead._id as Id<"leads">); }}
                      className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-container-low transition-all duration-150"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Detail Drawer */}
      {selectedLeadId && (
        <LeadDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}