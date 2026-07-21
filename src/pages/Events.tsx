import { useState, useEffect, useMemo, Fragment } from 'react'
import { getEvents, getEventsCounts, getCapiStatus, sendCapiEvent, cancelCapiEvent, requeueSkippedEvents, backfillLeadEvents } from '../api'
import { useClient } from '../ClientContext'
import { POSITIVE_STAGES, NEGATIVE_STAGES, stageClass } from '../constants'

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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [requeuing, setRequeuing] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)
  const [backfilling, setBackfilling] = useState(false)

  const handleBackfillLeadEvents = async () => {
    if (!window.confirm('Backfill any missing CAPI ladder events (Lead, Contact, QualifiedLead, ConversionLead) for leads whose current stage implies an event that was never sent to Meta? Safe to run more than once.')) return
    setBackfilling(true)
    setActionMessage(null)
    try {
      const res = await backfillLeadEvents()
      setActionMessage({
        kind: 'success',
        text: res.eventsCreated > 0
          ? `${res.eventsCreated} event(s) queued across ${res.leadsTouched} lead(s) (${res.alreadyCovered} of ${res.totalLeads} leads were already fully covered). They will send on the next flush.`
          : `All ${res.totalLeads} leads already have every CAPI event their current stage implies.`,
      })
      await load()
    } catch (err: any) {
      setActionMessage({ kind: 'error', text: err.message })
    } finally {
      setBackfilling(false)
    }
  }

  const handleRequeueSkipped = async () => {
    if (!window.confirm('Move all dry-run "skipped" events back to pending so they get sent? Only do this once live sending is enabled (META_CAPI_DRY_RUN=false), otherwise they will just be skipped again.')) return
    setRequeuing(true)
    setActionMessage(null)
    try {
      const res = await requeueSkippedEvents()
      setActionMessage({
        kind: 'success',
        text: res.dryRun
          ? `${res.requeued} re-queued — but CAPI is still in dry-run, so they will be skipped again. Set META_CAPI_DRY_RUN=false first.`
          : `${res.requeued} event(s) re-queued and will send shortly.`,
      })
      await load()
    } catch (err: any) {
      setActionMessage({ kind: 'error', text: err.message })
    } finally {
      setRequeuing(false)
    }
  }

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

  const handleExport = () => {
    const rows = events.map((ev: any) => [
      ev.eventName || '',
      ev.stage || '',
      ev.status || '',
      ev.leadName || '',
      ev.createdAt || '',
      ev.lastAttemptAt || '',
      ev.error || '',
    ])
    const header = 'Event,Stage,Status,Lead Name,Created,Sent,Error'
    const csv = header + '\n' + rows.map((r: string[]) =>
      r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events-export-${new Date().toISOString().substring(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Event Log</h1>
          <p className="text-sm text-muted mt-0.5">Conversion lead events</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExport}
            disabled={events.length === 0}
            className="h-8 px-3 text-xs font-medium border border-card-border rounded-md bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] disabled:opacity-40 disabled:cursor-not-allowed transition-all-expo"
          >
            Export CSV
          </button>
          <span className="w-px h-5 bg-card-border" aria-hidden="true" />
          <button
            onClick={handleBackfillLeadEvents}
            disabled={backfilling}
            title="Fills in any missing CAPI ladder events (Lead/Contact/QualifiedLead/ConversionLead) implied by each lead's current stage"
            className="h-8 px-3 text-xs font-medium border border-card-border rounded-md bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] disabled:opacity-40 disabled:cursor-not-allowed transition-all-expo"
          >
            {backfilling ? 'Backfilling…' : 'Backfill missing events'}
          </button>
          {(counts?.skipped || 0) > 0 && (
            <button
              onClick={handleRequeueSkipped}
              disabled={requeuing}
              title="Move dry-run skipped events back to pending so they can actually be sent"
              className="h-8 px-3 text-xs font-medium border border-card-border rounded-md bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] disabled:opacity-40 disabled:cursor-not-allowed transition-all-expo"
            >
              {requeuing ? 'Re-queuing…' : `Re-queue ${counts.skipped} skipped`}
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        actionMessage.kind === 'error' ? (
          <div className="warning-banner border border-red-100 bg-red-50">
            <p className="text-xs text-red-600">{actionMessage.text}</p>
          </div>
        ) : (
          <div className="warning-banner border border-green-200 bg-green-50">
            <p className="text-xs text-green-800">{actionMessage.text}</p>
          </div>
        )
      )}

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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
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
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all-expo tabular-nums ${
              statusFilter === s
                ? 'bg-[#0a0a0a] text-white'
                : 'border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4]'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            <span className={statusFilter === s ? 'text-white/60 ml-1' : 'text-muted/70 ml-1'}>
              {s ? counts?.[s] ?? 0 : counts?.total ?? 0}
            </span>
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
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-card-border bg-[#fafafa]">
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Event</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Stage</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Status</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Lead Name</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Created</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Sent</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Payload</th>
                <th className="py-2.5 pr-4 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev: any) => (
                <Fragment key={ev._id}>
                <tr className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-all-expo">
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
                    {ev.payloadSent ? (
                      <button
                        onClick={() => setExpandedId(expandedId === ev._id ? null : ev._id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-[#0a0a0a] transition-all-expo"
                      >
                        {expandedId === ev._id ? 'Hide' : 'View'}
                        <svg
                          xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="transition-transform duration-200"
                          style={{ transform: expandedId === ev._id ? 'rotate(180deg)' : 'none' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {ev.status === 'pending' ? (
                      <button
                        onClick={() => handleCancel(ev._id)}
                        disabled={cancelling === ev._id}
                        title="Cancel this pending event"
                        className="text-xs font-medium text-red-500 hover:text-red-700 transition-all-expo disabled:opacity-50"
                      >
                        {cancelling === ev._id ? 'Cancelling…' : 'Cancel'}
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
                          {retrying === ev._id ? 'Retrying…' : 'Retry'}
                        </button>
                        <button
                          onClick={() => handleCancel(ev._id)}
                          disabled={cancelling === ev._id}
                          title="Cancel this failed event"
                          className="text-xs font-medium text-red-500 hover:text-red-700 transition-all-expo disabled:opacity-50"
                        >
                          {cancelling === ev._id ? 'Cancelling…' : 'Cancel'}
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
                {expandedId === ev._id && ev.payloadSent && (
                  <tr className="border-b border-[#f5f5f5] bg-[#fafafa]">
                    <td colSpan={8} className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider font-medium text-muted mb-1.5">
                        Payload sent to Meta
                      </p>
                      <pre className="text-[11px] leading-relaxed text-[#0a0a0a] whitespace-pre-wrap break-all bg-white border border-card-border rounded-md p-3 max-h-80 overflow-auto">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(ev.payloadSent), null, 2)
                          } catch {
                            return ev.payloadSent
                          }
                        })()}
                      </pre>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}