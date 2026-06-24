import { useState, useEffect } from 'react'
import { getEvents, getEventsCounts } from '../api'

export default function Events() {
  const [events, setEvents] = useState<any[]>([])
  const [counts, setCounts] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getEvents(), getEventsCounts()])
      .then(([e, c]) => {
        setEvents(e.events || e || [])
        setCounts(c)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-400 text-sm">Loading events...</div></div>
  }

  const statusBadge = (status: string) => {
    const m: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      sent: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-red-100 text-red-700',
    }
    return m[status] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Event Log</h1>
        <p className="text-sm text-muted mt-0.5">Conversion lead events</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: counts?.pending || 0, color: 'text-amber-600' },
          { label: 'Sent', value: counts?.sent || 0, color: 'text-emerald-600' },
          { label: 'Failed', value: counts?.failed || 0, color: 'text-red-600' },
          { label: 'Total', value: counts?.total || 0, color: 'text-indigo-600' },
        ].map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-card-border p-4">
            <p className="text-xs text-muted font-medium">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Events Table */}
      <div className="bg-card rounded-xl border border-card-border overflow-hidden">
        {events.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No CRM events yet. Change a lead stage to create events.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-gray-100 bg-gray-50/50">
                  <th className="p-3 font-medium">Event</th>
                  <th className="p-3 font-medium">Stage</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Lead Name</th>
                  <th className="p-3 font-medium">Meta Lead ID</th>
                  <th className="p-3 font-medium">Created</th>
                  <th className="p-3 font-medium">Attempts</th>
                  <th className="p-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev: any) => (
                  <tr key={ev._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="p-3 font-medium text-gray-800">{ev.eventName}</td>
                    <td className="p-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {ev.stage}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(ev.status)}`}>
                        {ev.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">{ev.leadName || '—'}</td>
                    <td className="p-3 text-gray-400 font-mono text-xs">{ev.metaLeadId}</td>
                    <td className="p-3 text-gray-500 tabular-nums text-xs">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-gray-500 tabular-nums">{ev.attempts}</td>
                    <td className="p-3 text-red-500 text-xs max-w-[200px] truncate">{ev.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}