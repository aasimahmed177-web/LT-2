import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-bg text-amber border-amber/20',
    sent: 'bg-green-bg text-green border-green/20',
    failed: 'bg-red-bg text-red border-red/20',
    skipped: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`pill border ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse mr-0.5" />}
      {status}
    </span>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="kpi-compact">
      <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <p className="text-base font-bold text-foreground tracking-tight">{value}</p>
      </div>
    </div>
  );
}

export default function Events() {
  const events = useQuery(api.events.listEvents as any, {});

  const pendingCount = events ? events.filter((e: any) => e.status === 'pending').length : 0;
  const sentCount = events ? events.filter((e: any) => e.status === 'sent').length : 0;
  const failedCount = events ? events.filter((e: any) => e.status === 'failed').length : 0;

  return (
    <div className="max-w-full fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="page-title">CRM Events</h1>
          <p className="page-subtitle">Pending stage-change events created in Convex</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Pending" value={pendingCount} color="bg-amber" />
        <SummaryCard label="Sent" value={sentCount} color="bg-green" />
        <SummaryCard label="Failed" value={failedCount} color="bg-red" />
        <SummaryCard label="Total" value={events?.length || 0} color="bg-ink-muted" />
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {!events ? (
          <div className="overflow-x-auto">
            <table className="table-crm">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Event</th>
                  <th>Lead</th>
                  <th>Meta Lead ID</th>
                  <th>Created</th>
                  <th>Attempts</th>
                  <th>Error</th>
                  <th>Idempotency Key</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>
                    <td><div className="h-5 w-20 bg-surface-container-high rounded-full" /></td>
                    <td><div className="h-3 w-24 bg-surface-container-high rounded" /></td>
                    <td><div className="h-3 w-28 bg-surface-container-high rounded" /></td>
                    <td><div className="h-3 w-24 bg-surface-container-high rounded" /></td>
                    <td><div className="h-3 w-20 bg-surface-container-high rounded" /></td>
                    <td><div className="h-3 w-8 bg-surface-container-high rounded" /></td>
                    <td><div className="h-3 w-16 bg-surface-container-high rounded" /></td>
                    <td><div className="h-3 w-20 bg-surface-container-high rounded" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : events.length === 0 ? (
          <div className="relative p-10 text-center overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }} />
            <div className="relative z-1">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <p className="text-sm font-semibold text-ink mb-1">No CRM events yet</p>
              <p className="text-xs text-ink-muted">Changing a lead stage will create pending CRM events here.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-crm">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Event</th>
                  <th>Lead</th>
                  <th>Meta Lead ID</th>
                  <th>Created</th>
                  <th>Attempts</th>
                  <th>Error</th>
                  <th>Idempotency Key</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: any) => (
                  <tr key={event._id}>
                    <td><StatusPill status={event.status} /></td>
                    <td>
                      <span className="text-sm font-semibold text-ink">{event.eventName}</span>
                    </td>
                    <td>
                      <span className="text-xs font-mono text-ink-muted">{event.leadId}</span>
                    </td>
                    <td>
                      <span className="text-xs font-mono text-ink-muted">{event.metaLeadId || '—'}</span>
                    </td>
                    <td>
                      <span className="text-[11px] text-ink-muted whitespace-nowrap">{formatDate(event.createdAt)}</span>
                    </td>
                    <td>
                      <span className="text-sm text-ink-muted">{event.attemptCount || 0}</span>
                    </td>
                    <td className="max-w-[200px]">
                      <span className="text-xs text-red truncate block" title={event.errorMessage}>{event.errorMessage || '—'}</span>
                    </td>
                    <td>
                      <span className="text-[10px] font-mono text-ink-faint">{event.idempotencyKey || '—'}</span>
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