import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    sent: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700',
    skipped: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md ${colors[status] || 'bg-gray-100 text-gray-500'}`}>
      {status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
      {status}
    </span>
  );
}

export default function EventLog() {
  const events = useQuery(api.events.listEvents);
  const failedEvents = useQuery(api.events.listFailedEvents);
  const leads = useQuery(api.leads.listLeads, {});

  const getLeadInfo = (leadId: string) => {
    if (!leads) return null;
    return leads.find(l => l._id === leadId);
  };

  if (!events) {
    return (
      <div className="max-w-6xl fade-in">
        <div className="page-header mb-6">
          <h1 className="page-title">Event Log</h1>
          <p className="page-subtitle">CRM Conversion Leads event tracking</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Event Log</h1>
          <p className="text-xs font-medium text-ink-secondary mt-0.5">
            {events.length} events &middot; {failedEvents?.length || 0} failed
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Total Events</p>
          <p className="text-2xl font-bold text-ink mt-1">{events.length}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{events.filter(e => e.status === 'pending').length}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Sent</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{events.filter(e => e.status === 'sent').length}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Failed</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{events.filter(e => e.status === 'failed').length}</p>
        </div>
      </div>

      {/* Events table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Lead</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Phone</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Meta Lead ID</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Event</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Status</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Attempts</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Created</th>
                <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Error</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <p className="text-sm text-ink-muted font-medium">No events recorded yet</p>
                    <p className="text-xs text-ink-muted mt-1">Events are created when lead stages are updated</p>
                  </td>
                </tr>
              ) : events.map(e => {
                const lead = getLeadInfo(e.leadId);
                return (
                  <tr key={e._id} className="border-b border-border-subtle hover:bg-surface-container-low transition-colors duration-100">
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-semibold text-ink">{lead?.fullName || <span className="text-ink-muted">Unknown</span>}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-ink font-mono">{lead?.phoneNumber || <span className="text-ink-muted">—</span>}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-ink-muted font-mono">{e.metaLeadId || <span className="text-ink-muted">—</span>}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-semibold text-ink">{e.eventName}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-ink">{e.attemptCount}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-ink-muted">{formatDate(e.createdAt)}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <span className="text-[11px] text-red-600 truncate block">{e.errorMessage || <span className="text-ink-muted">—</span>}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 p-4 rounded-xl border border-border bg-surface-muted">
        <p className="text-xs text-ink-secondary leading-relaxed">
          <strong className="text-ink">Note:</strong> Events are created as <strong className="text-ink">pending</strong> when lead stages are updated to Contact, Prospect, ConversionLead, or Purchase.
          Actual sending to Meta will be implemented in Phase 2.
        </p>
      </div>
    </div>
  );
}