import { useState, useEffect, useMemo } from 'react'
import { getEvents, getEventsCounts } from '../api'

const statusColors: Record<string, string> = {
  pending: '#a0a0a0',
  sent: '#0a0a0a',
  failed: '#dc2626',
}

export default function Events() {
  const [events, setEvents] = useState<any[]>([])
  const [counts, setCounts] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    Promise.all([getEvents(), getEventsCounts()])
      .then(([e, c]) => {
        setEvents(e.events || e || [])
        setCounts(c)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!statusFilter) return events
    return events.filter((ev) => ev.status === statusFilter)
  }, [events, statusFilter])

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted text-sm">Loading events...</div></div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Event Log</h1>
        <p className="text-sm text-muted mt-0.5">Conversion lead events</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: counts?.pending || 0 },
          { label: 'Sent', value: counts?.sent || 0 },
          { label: 'Failed', value: counts?.failed || 0 },
          { label: 'Total', value: counts?.total || 0 },
        ].map((card) => (
          <div key={card.label} className="border border-card-border rounded-lg p-4 hover:border-[#d4d4d4] transition-colors">
            <p className="text-[11px] text-muted font-medium">{card.label}</p>
            <p className="text-[26px] font-bold text-[#0a0a0a] mt-1 tabular-nums tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted font-medium">Filter:</span>
        {['', 'pending', 'sent', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === s
                ? 'bg-accent text-white'
                : 'border border-card-border text-muted hover:border-[#d4d4d4] hover:text-[#0a0a0a]'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {/* Events Table */}
      <div className="border border-card-border rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {statusFilter ? `No ${statusFilter} events` : 'No CRM events yet. Change a lead stage to create events.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs border-b border-card-border bg-[#fafafa]">
                <th className="p-3 font-medium text-muted">Event</th>
                <th className="p-3 font-medium text-muted">Stage</th>
                <th className="p-3 font-medium text-muted">Status</th>
                <th className="p-3 font-medium text-muted">Lead Name</th>
                <th className="p-3 font-medium text-muted">Meta Lead ID</th>
                <th className="p-3 font-medium text-muted">Created</th>
                <th className="p-3 font-medium text-muted">Attempts</th>
                <th className="p-3 font-medium text-muted">Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev: any) => (
                <tr key={ev._id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors">
                  <td className="p-3 font-medium text-[#0a0a0a]">{ev.eventName}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]" />
                      {ev.stage}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusColors[ev.status] || '#a0a0a0' }}
                      />
                      {ev.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted">{ev.leadName || '—'}</td>
                  <td className="p-3 text-[#9e9e9e] font-mono text-xs">{ev.metaLeadId}</td>
                  <td className="p-3 text-muted tabular-nums text-xs">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="p-3 text-muted tabular-nums">{ev.attempts}</td>
                  <td className="p-3 text-red-500 text-xs max-w-[200px] truncate">{ev.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}