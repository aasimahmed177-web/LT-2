import { useState, useEffect, useMemo } from 'react'
import { getEvents, getEventsCounts } from '../api'
import { useClient } from '../ClientContext'

const statusColors: Record<string, string> = {
  pending: '#a0a0a0',
  sent: '#0a0a0a',
  failed: '#dc2626',
}

export default function Events() {
  const { currentClientId } = useClient()
  const [events, setEvents] = useState<any[]>([])
  const [counts, setCounts] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    Promise.all([getEvents(currentClientId), getEventsCounts(currentClientId)])
      .then(([e, c]) => {
        setEvents(e.events || e || [])
        setCounts(c)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentClientId])

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
          <div key={card.label} className="border border-card-border rounded-xl p-5 hover:border-[#d4d4d4] transition-all duration-150">
            <p className="text-[10px] text-muted font-medium uppercase tracking-wider">{card.label}</p>
            <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums tracking-tight leading-none">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted font-medium mr-1">Filter:</span>
        {['', 'pending', 'sent', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-100 ${
              statusFilter === s
                ? 'bg-[#0a0a0a] text-white'
                : 'border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4]'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {/* Events Table */}
      <div className="border border-card-border rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted">
              {statusFilter
                ? `No ${statusFilter} events`
                : 'No CRM events yet. Change a lead stage to create events.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-card-border bg-[#fafafa]">
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Event</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Stage</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Status</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Lead Name</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Meta Lead ID</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Created</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Attempts</th>
                <th className="py-2.5 pr-4 text-[11px] uppercase tracking-wider font-medium text-muted">Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev: any) => (
                <tr key={ev._id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors duration-100">
                  <td className="px-4 py-3 pr-4 font-medium text-[#0a0a0a] text-sm">{ev.eventName}</td>
                  <td className="py-3 pr-4">
                    <span className="stage-pill">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]" />
                      {ev.stage}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusColors[ev.status] || '#a0a0a0' }}
                      />
                      <span className={ev.status === 'failed' ? 'text-red-600' : ev.status === 'sent' ? 'text-emerald-600' : 'text-muted'}>
                        {ev.status}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted text-xs">{ev.leadName || '—'}</td>
                  <td className="py-3 pr-4 text-muted font-mono text-[11px]">{ev.metaLeadId}</td>
                  <td className="py-3 pr-4 text-muted tabular-nums text-xs">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 pr-4 text-muted tabular-nums text-xs">{ev.attempts}</td>
                  <td className="py-3 pr-4 text-red-500 text-xs max-w-[180px] truncate">{ev.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}