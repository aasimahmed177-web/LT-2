import { useState, useEffect, useMemo } from 'react'
import { getEvents, getEventsCounts, getCapiStatus, sendCapiEvent, cancelCapiEvent } from '../api'
import { useClient } from '../ClientContext'

export default function Events() {
  const { currentClientId } = useClient()
  const [events, setEvents] = useState<any[]>([])
  const [counts, setCounts] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [retrying, setRetrying] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [capiStatus, setCapiStatus] = useState<any>(null)

  const load = () => {
    setLoading(true)
    Promise.all([getEvents(currentClientId), getEventsCounts(currentClientId), getCapiStatus()])
      .then(([e, c, cs]) => {
        setEvents(e.events || e || [])
        setCounts(c)
        if (cs) setCapiStatus(cs)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [currentClientId])

  const handleRetry = async (eventId: string) => {
    setRetrying(eventId)
    try {
      await sendCapiEvent(eventId)
      await load()
    } catch (err: any) {
      console.error('Retry error:', err)
    } finally {
      setRetrying(null)
    }
  }

  const handleCancel = async (eventId: string) => {
    setCancelling(eventId)
    setCancelError(null)
    try {
      await cancelCapiEvent(eventId)
      await load()
    } catch (err: any) {
      console.error('Cancel error:', err)
      setCancelError(err.message)
    } finally {
      setCancelling(null)
    }
  }

  const filtered = useMemo(() => {
    if (!statusFilter) return events
    return events.filter((ev) => ev.status === statusFilter)
  }, [events, statusFilter])

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted text-sm">Loading events...</div></div>
  }

  const POSITIVE_STAGES = new Set(['Contact', 'Prospect', 'ConversionLead', 'Purchase'])
  const NEGATIVE_STAGES = new Set(['NotQualified', 'NoResponse', 'Invalid', 'Duplicate'])
  const stageClass = (s: string) => POSITIVE_STAGES.has(s) ? 'stage-positive' : NEGATIVE_STAGES.has(s) ? 'stage-negative' : 'stage-neutral'

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Event Log</h1>
        <p className="text-sm text-muted mt-0.5">Conversion lead events</p>
      </div>

      {/* CAPI Warning Banners */}
      {capiStatus && !capiStatus.dryRun && capiStatus.capiCapable && (
        <div className="warning-banner border border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Live CAPI mode is ON</p>
          <p className="text-xs text-amber-700 mt-1">Positive final-stage changes can send events to Meta. Events listed below reflect the actual send status.</p>
        </div>
      )}
      {capiStatus && capiStatus.dryRun && (
        <div className="warning-banner border border-blue-200 bg-blue-50">
          <p className="text-sm font-semibold text-blue-800">Dry-run mode is ON</p>
          <p className="text-xs text-blue-700 mt-1">Events are recorded but not sent to Meta.</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-7 gap-4">
        {[
          { label: 'Pending', value: counts?.pending || 0 },
          { label: 'Sent', value: counts?.sent || 0 },
          { label: 'Suppressed', value: counts?.suppressed || 0 },
          { label: 'Skipped', value: counts?.skipped || 0 },
          { label: 'Failed', value: counts?.failed || 0 },
          { label: 'Cancelled', value: counts?.cancelled || 0 },
          { label: 'Total', value: counts?.total || 0 },
        ].map((card) => (
          <div key={card.label} className="kpi-card">
            <p className="text-[10px] text-muted font-medium uppercase tracking-wider">{card.label}</p>
            <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums tracking-tight leading-none">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-muted font-medium mr-1">Filter:</span>
{['', 'pending', 'sent', 'suppressed', 'skipped', 'failed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all-expo ${
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
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Created</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Sent</th>
                <th className="py-2.5 pr-4 text-[11px] uppercase tracking-wider font-medium text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev: any) => (
                <tr key={ev._id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-all-expo">
                  <td className="px-4 py-3 pr-4 font-medium text-[#0a0a0a] text-sm">{ev.eventName}</td>
                  <td className="py-3 pr-4">
                    <span className={stageClass(ev.stage)}>
                      <span className={`w-1.5 h-1.5 rounded-full ${POSITIVE_STAGES.has(ev.stage) ? 'bg-white' : NEGATIVE_STAGES.has(ev.stage) ? 'bg-[#d4d4d4]' : 'bg-[#0a0a0a]'}`} />
                      {ev.stage}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`event-pill-${ev.status === 'dry_run' ? 'skipped' : ev.status}`}>
                      {ev.status === 'dry_run' ? 'dry-run' : ev.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted text-xs">{ev.leadName || '—'}</td>
                  <td className="py-3 pr-4 text-muted tabular-nums text-xs">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 pr-4 text-muted tabular-nums text-xs">
                    {ev.lastAttemptAt ? new Date(ev.lastAttemptAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    {ev.status === 'pending' ? (
                      <button
                        onClick={() => handleCancel(ev._id)}
                        disabled={cancelling === ev._id}
                        className="text-xs font-medium text-red-500 hover:text-red-700 transition-all-expo disabled:opacity-50"
                      >
                        {cancelling === ev._id ? 'Cancelling...' : 'Cancel event'}
                      </button>
) : ev.status === 'suppressed' ? (
                      <span className="text-xs text-amber-600 font-medium">Superseded</span>
                    ) : ev.status === 'failed' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRetry(ev._id)}
                          disabled={retrying === ev._id}
                          className="text-xs font-medium text-muted hover:text-[#0a0a0a] transition-all-expo disabled:opacity-50"
                        >
                          {retrying === ev._id ? 'Retrying...' : 'Retry'}
                        </button>
                        <button
                          onClick={() => handleCancel(ev._id)}
                          disabled={cancelling === ev._id}
                          className="text-xs font-medium text-red-500 hover:text-red-700 transition-all-expo disabled:opacity-50"
                        >
                          {cancelling === ev._id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      </div>
                    ) : ev.status === 'cancelled' ? (
                      <span className="text-xs text-muted">Cancelled</span>
                    ) : ev.status === 'skipped' || ev.status === 'dry_run' ? (
                      <span className="text-xs text-muted">Recorded (dry-run)</span>
                    ) : ev.status === 'sent' ? (
                      <span className="text-xs text-muted">—</span>
                    ) : ev.error ? (
                      <span className="text-xs text-red-500 max-w-[160px] inline-block truncate" title={ev.error}>{ev.error}</span>
                    ) : ev.response ? (
                      <span className="text-xs text-muted max-w-[160px] inline-block truncate" title={ev.response}>{ev.response}</span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                    {cancelError && <span className="text-xs text-red-500 ml-2">{cancelError}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}