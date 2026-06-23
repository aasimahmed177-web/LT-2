import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-gray-50 text-gray-500 border-gray-200',
};

export default function Events() {
  const events = useQuery(api.events.listEvents as any, {});

  return (
    <div className="max-w-full fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Event Log</h1>
          <p className="text-xs font-medium text-ink-secondary mt-0.5">
            {events ? `${events.length} pending CRM events` : 'Loading...'}
          </p>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {!events ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Event Name</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Stage</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Status</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Lead ID</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Meta Lead ID</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Created</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Attempts</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Error</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border-subtle animate-pulse" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>
                    <td className="px-3 py-2.5"><div className="h-4 w-24 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-4 w-16 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-5 w-20 bg-surface-container-high rounded-full" /></td>
                    <td className="px-3 py-2.5"><div className="h-4 w-28 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-4 w-24 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-4 w-20 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-4 w-8 bg-surface-container-high rounded" /></td>
                    <td className="px-3 py-2.5"><div className="h-4 w-16 bg-surface-container-high rounded" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <p className="text-sm text-ink-muted font-medium">No events yet</p>
            <p className="text-xs text-ink-muted mt-1">Stage changes will create events here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Event Name</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Stage</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Status</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Lead ID</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Meta Lead ID</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Created</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Attempts</th>
                  <th className="text-left text-[11px] font-semibold text-ink-secondary px-3 py-2.5 uppercase tracking-wider">Error</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: any) => (
                  <tr key={event._id} className="border-b border-border-subtle hover:bg-surface-container-low transition-colors duration-100">
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-semibold text-ink">{event.eventName}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-ink">{event.stage}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border ${STATUS_STYLES[event.status] || 'bg-gray-50 text-gray-500'}`}>
                        {event.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />}
                        {event.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono text-ink-muted">{event.leadId}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono text-ink-muted">{event.metaLeadId || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-ink-muted whitespace-nowrap">{formatDate(event.createdAt)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-ink-muted">{event.attemptCount || 0}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <span className="text-xs text-red-600 truncate block" title={event.errorMessage}>{event.errorMessage || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}