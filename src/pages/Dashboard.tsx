import { useState, useEffect, useMemo, useRef } from 'react'
import { getStats, getLeads, getSourceOfTruth, getCallActivities } from '../api'
import { useClient } from '../ClientContext'
import { POSITIVE_STAGES, NEGATIVE_STAGES, stageClass, STAGE_COLOR_VAR } from '../constants'
import { deriveLeadJourneyStatus } from '../leadJourney'

function getMetaCreated(lead: any): string {
  return lead?.fullResponse?.created_time || lead.ingestedAt || ''
}

function isTestLead(lead: any): boolean {
  return !!lead?.name?.includes('test lead: dummy data')
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
] as const

function getDateRange(preset: string, customStart: string, customEnd: string): { start: Date; end: Date } | null {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (preset === 'all') return null

  if (preset === 'custom') {
    if (!customStart || !customEnd) return null
    return { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59.999') }
  }

  const found = DATE_PRESETS.find((p) => p.label === preset)
  if (!found) return null

  if (found.days === 0) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { start, end }
  }
  const start = new Date(end.getTime() - found.days * 24 * 60 * 60 * 1000)
  return { start, end }
}

function isInRange(createdTime: string, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true
  if (!createdTime) return false
  const d = new Date(createdTime)
  return d >= range.start && d <= range.end
}

export default function Dashboard() {
  const { currentClientId, currentClient } = useClient()
  const [stats, setStats] = useState<any>(null)
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [sourceOfTruth, setSourceOfTruth] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [datePreset, setDatePreset] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [formFilter, setFormFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [showTestLeads, setShowTestLeads] = useState(false)

  // Chart hover state
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      getStats(currentClientId),
      getLeads(currentClientId, { limit: 1000 }),
      getSourceOfTruth(currentClientId),
      getCallActivities().catch(() => ({ activities: [] })),
    ])
      .then(([s, l, t, a]) => {
        setStats(s)
        setAllLeads(l.leads || [])
        setSourceOfTruth(t)
        setActivities(a?.activities || [])
      })
      .catch((err) => {
        console.error(err)
        setStats({ total: 0, last24h: 0, newToday: 0, pendingCrmEvents: 0, contacted: 0, prospects: 0, conversionLeads: 0, purchases: 0, notQualified: 0, funnel: [], activityByDate: {}, byStage: {} })
        setSourceOfTruth(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [currentClientId])

  const dateRange = useMemo(() => getDateRange(datePreset, customStart, customEnd), [datePreset, customStart, customEnd])

  // Unique filter options from all leads
  const filterOptions = useMemo(() => {
    const campaigns = new Set<string>()
    const forms = new Set<string>()
    const sources = new Set<string>()
    const stages = new Set<string>()
    for (const l of allLeads) {
      if (l.campaignName) campaigns.add(l.campaignName)
      if (l.formName) forms.add(l.formName)
      if (l.platform) sources.add(l.platform)
      if (l.stage) stages.add(l.stage)
    }
    return {
      campaigns: Array.from(campaigns).sort(),
      forms: Array.from(forms).sort(),
      sources: Array.from(sources).sort(),
      stages: Array.from(stages).sort(),
    }
  }, [allLeads])

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      if (!isInRange(getMetaCreated(lead), dateRange)) return false
      if (stageFilter && lead.stage !== stageFilter) return false
      if (campaignFilter && lead.campaignName !== campaignFilter) return false
      if (formFilter && lead.formName !== formFilter) return false
      if (sourceFilter && lead.platform !== sourceFilter) return false
      if (!showTestLeads && isTestLead(lead)) return false
      return true
    })
  }, [allLeads, dateRange, stageFilter, campaignFilter, formFilter, sourceFilter, showTestLeads])

  // Computed stats from filtered leads
  const filteredStats = useMemo(() => {
    const byStage: Record<string, number> = {}
    const byDate: Record<string, number> = {}
    let total = 0
    for (const l of filteredLeads) {
      total++
      byStage[l.stage] = (byStage[l.stage] || 0) + 1
      const d = getMetaCreated(l).substring(0, 10)
      if (d) byDate[d] = (byDate[d] || 0) + 1
    }
    const stageOrder = ['Lead', 'Contact', 'Prospect', 'ConversionLead', 'Purchase']
    const funnel = stageOrder.map((stage) => ({ stage, count: byStage[stage] || 0 }))
    return { total, byStage, funnel, activityByDate: byDate }
  }, [filteredLeads])

  // Lead-journey funnel. Deliberately CUMULATIVE ("reached at least this
  // step"), unlike the stage distribution below which is a snapshot of where
  // leads currently sit. A lead at ConversionLead was necessarily contacted and
  // interested first, so it must count toward those earlier steps too —
  // otherwise the step-to-step conversion rates are meaningless.
  //
  // Terminal negative stages still carry progress information:
  //   NotQualified  -> they WERE contacted (you spoke to them to disqualify)
  //   NoResponse    -> attempted but never reached
  //   Invalid/Dup   -> attempted, unusable number
  // Call activity ("Call Picked?") refines this where the CSV supplied it.
  const activityMap = useMemo(() => {
    const map = new Map<string, any>()
    for (const a of activities) if (a.metaLeadId) map.set(a.metaLeadId, a)
    return map
  }, [activities])

  const journey = useMemo(() => {
    let neverCalled = 0, attempted = 0, contacted = 0, interested = 0, meetingBooked = 0, purchased = 0
    let noResponse = 0, invalidNumber = 0, notQualified = 0, stalledAtContact = 0

    // The "Where every lead stands" bar below needs a strict partition —
    // exactly one bucket per lead, guaranteed to sum to the total — so it's
    // built from `stage` alone rather than the activity-refined flags above
    // (which deliberately overlap: e.g. isInterested also credits a
    // call-activity signal even when stage hasn't caught up to Prospect yet).
    let snapStillInPlay = 0, snapContact = 0, snapNotQualified = 0, snapNoResponse = 0, snapInvalid = 0
    let snapLeadAttempted = 0, snapLeadNeverCalled = 0

    for (const l of filteredLeads) {
      const a = activityMap.get(l.metaLeadId)
      const stage = l.stage
      const status = deriveLeadJourneyStatus(stage, a)

      if (status.isAttempted) attempted++; else neverCalled++
      if (status.isContacted) contacted++
      if (status.isInterested) interested++
      if (status.isMeetingBooked) meetingBooked++
      if (status.isPurchased) purchased++

      if (status.isNoResponse) noResponse++
      if (status.isInvalid) invalidNumber++
      if (status.isNotQualified) notQualified++
      if (status.isStalledAtContact) stalledAtContact++

      if (['Prospect', 'ConversionLead', 'Purchase'].includes(stage)) snapStillInPlay++
      else if (stage === 'Contact') snapContact++
      else if (stage === 'NotQualified') snapNotQualified++
      else if (stage === 'NoResponse') snapNoResponse++
      else if (stage === 'Invalid' || stage === 'Duplicate') snapInvalid++
      else if (status.isAttempted) snapLeadAttempted++
      else snapLeadNeverCalled++
    }

    const total = filteredLeads.length
    return {
      total, neverCalled, attempted, contacted, interested, meetingBooked, purchased,
      noResponse, invalidNumber, notQualified, stalledAtContact,
      snapStillInPlay, snapContact, snapNotQualified, snapNoResponse, snapInvalid,
      snapLeadAttempted, snapLeadNeverCalled,
      steps: [
        { key: 'total', label: 'Leads received', count: total, lost: 0, lostLabel: '' },
        { key: 'attempted', label: 'Attempted', count: attempted, lost: neverCalled, lostLabel: 'never called' },
        { key: 'contacted', label: 'Contacted', count: contacted, lost: attempted - contacted, lostLabel: 'no answer / invalid number' },
        { key: 'interested', label: 'Interested', count: interested, lost: contacted - interested, lostLabel: 'not qualified / stalled' },
        { key: 'meeting', label: 'Meeting booked', count: meetingBooked, lost: interested - meetingBooked, lostLabel: 'no meeting booked' },
        { key: 'purchase', label: 'Purchased', count: purchased, lost: meetingBooked - purchased, lostLabel: 'not closed' },
      ],
    }
  }, [filteredLeads, activityMap])

  // Ad-level breakdown: which ads actually produce ConversionLeads/Purchases,
  // not just raw lead volume.
  const byAdStats = useMemo(() => {
    const map = new Map<string, { adName: string; total: number; byStage: Record<string, number> }>()
    for (const l of filteredLeads) {
      const adName = l.adName || 'Unknown / Organic'
      if (!map.has(adName)) map.set(adName, { adName, total: 0, byStage: {} })
      const entry = map.get(adName)!
      entry.total++
      entry.byStage[l.stage] = (entry.byStage[l.stage] || 0) + 1
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filteredLeads])

  const hasFilters = datePreset !== 'all' || stageFilter || campaignFilter || formFilter || sourceFilter || showTestLeads

  const clearFilters = () => {
    setDatePreset('all')
    setCustomStart('')
    setCustomEnd('')
    setStageFilter('')
    setCampaignFilter('')
    setFormFilter('')
    setSourceFilter('')
    setShowTestLeads(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted text-sm">Loading dashboard...</div>
      </div>
    )
  }

  const stageLabels: Record<string, string> = {
    Lead: 'Lead', Contact: 'Contact', Prospect: 'Prospect',
    ConversionLead: 'Conv. Lead', Purchase: 'Purchase',
  }

  const activityEntries = Object.entries(filteredStats.activityByDate).sort()
  const maxActivity = Math.max(...activityEntries.map(([, c]) => c as number), 1)

  // Determine which activity dates to show
  const activitySlice = datePreset === 'all' || datePreset === 'Last 30 days'
    ? activityEntries.slice(-30)
    : activityEntries.slice(-14)

  const barGap = activitySlice.length > 14 ? 2 : 3
  const chartW = 600
  const chartH = 150
  const barCount = activitySlice.length
  const barWidth = Math.min(26, Math.max(8, (chartW - barCount * barGap - 20) / barCount))
  const padLeft = 10
  const padTop = 20
  const padBottom = 20

  const FilterSelect = ({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2.5 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo min-w-[110px]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  const todayStr = new Date().toISOString().substring(0, 10)

  // Generate line points for the overlay
  const linePoints = activitySlice.map(([date, count], i) => {
    const x = padLeft + i * (barWidth + barGap) + barWidth / 2
    const h = chartH - padBottom - ((count as number) / maxActivity) * (chartH - padTop - padBottom)
    return { x, y: h, date, count: count as number }
  })

  const linePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = linePoints.length > 0
    ? `${linePath} L${linePoints[linePoints.length - 1].x},${chartH - padBottom} L${linePoints[0].x},${chartH - padBottom} Z`
    : ''

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">
            {currentClient?.name || 'LeadTrace CRM'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-30" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-emerald-600">Live</span>
        </div>
      </div>

      {/* Date Preset Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setDatePreset(p.label)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all-expo ${
              datePreset === p.label
                ? 'bg-[#0a0a0a] text-white'
                : 'border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4]'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setDatePreset('all')}
          className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all-expo ${
            datePreset === 'all'
              ? 'bg-[#0a0a0a] text-white'
              : 'border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4]'
          }`}
        >
          All time
        </button>
        <button
          onClick={() => setDatePreset('custom')}
          className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all-expo ${
            datePreset === 'custom'
              ? 'bg-[#0a0a0a] text-white'
              : 'border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4]'
          }`}
        >
          Custom
        </button>
        {datePreset === 'custom' && (
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-7 px-2 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a]"
            />
            <span className="text-xs text-muted">—</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-7 px-2 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a]"
            />
          </div>
        )}
      </div>

      {/* Other Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect value={stageFilter} onChange={setStageFilter} options={filterOptions.stages} placeholder="All stages" />
        <FilterSelect value={campaignFilter} onChange={setCampaignFilter} options={filterOptions.campaigns} placeholder="All campaigns" />
        <FilterSelect value={formFilter} onChange={setFormFilter} options={filterOptions.forms} placeholder="All forms" />
        <FilterSelect value={sourceFilter} onChange={setSourceFilter} options={filterOptions.sources} placeholder="All sources" />
        <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={showTestLeads}
            onChange={(e) => setShowTestLeads(e.target.checked)}
            className="w-3 h-3 rounded border-card-border accent-[#0a0a0a]"
          />
          Show tests
        </label>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-[11px] text-muted hover:text-[#0a0a0a] transition-all-expo underline ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Hero Section: Total Pipeline + Activity Chart */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-5">
        {/* Pipeline stat card */}
        <div className="border border-card-border rounded-xl p-6 flex flex-col justify-between transition-all-expo hover:border-[#d4d4d4]">
          <div>
            <p className="section-label">Total Pipeline</p>
            <p className="text-[44px] font-bold text-[#0a0a0a] mt-2 tabular-nums tracking-tight leading-none">
              {filteredStats.total}
            </p>
            {!hasFilters && stats && (
              <p className="text-xs text-muted mt-2">{stats.last24h} in last 24h</p>
            )}
            {hasFilters && (
              <p className="text-xs text-muted mt-2">Filtered view</p>
            )}
          </div>
          <div className="flex gap-5 mt-5 pt-5 border-t border-card-border">
            <div>
              <p className="text-[22px] font-bold text-[#0a0a0a] tabular-nums tracking-tight">{stats?.newToday || 0}</p>
              <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wider">New today</p>
            </div>
            <div>
              <p className="text-[22px] font-bold text-[#0a0a0a] tabular-nums tracking-tight">{stats?.pendingCrmEvents || 0}</p>
              <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wider">Pending events</p>
            </div>
          </div>
          {/* Untouched leads alert */}
          {!hasFilters && filteredStats.byStage?.Lead > 0 && (
            <div className="mt-3 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⏸</span>
                <div>
                  <p className="text-[13px] font-semibold text-amber-900 tabular-nums">{filteredStats.byStage.Lead} untouched</p>
                  <p className="text-[10px] text-amber-700">Leads not yet contacted</p>
                </div>
              </div>
              <a href="/leads?stage=Lead" className="text-[11px] text-amber-800 underline hover:text-amber-900 font-medium">View all</a>
            </div>
          )}
        </div>

        {/* Activity chart */}
        <div className="border border-card-border rounded-xl p-6 transition-all-expo hover:border-[#d4d4d4]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-label">Lead Activity</p>
              <p className="text-[10px] text-muted mt-0.5">
                {datePreset === 'all' ? 'All time' : `Last ${activitySlice.length} days`}
              </p>
            </div>
            {hoveredBar !== null && activitySlice[hoveredBar] && (
              <div className="text-right">
                <p className="text-xs font-semibold text-[#0a0a0a] tabular-nums">{activitySlice[hoveredBar][1]} leads</p>
                <p className="text-[10px] text-muted">{activitySlice[hoveredBar][0]}</p>
              </div>
            )}
          </div>
          {activitySlice.length > 0 ? (
            <div ref={chartRef} className="relative">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" style={{ height: chartH }}>
                {/* Grid lines */}
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <line
                    key={pct}
                    x1={0} y1={chartH - padBottom - (chartH - padTop - padBottom) * pct}
                    x2={chartW} y2={chartH - padBottom - (chartH - padTop - padBottom) * pct}
                    stroke="var(--chart-grid)" strokeWidth={1}
                  />
                ))}

                {/* Gradient fill for area */}
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-ink)" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="var(--chart-ink)" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--chart-ink)" />
                    <stop offset="100%" stopColor="var(--chart-muted)" />
                  </linearGradient>
                </defs>

                {/* Area fill */}
                {areaPath && (
                  <path d={areaPath} fill="url(#areaGrad)" />
                )}

                {/* Line */}
                {linePath && (
                  <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Bars */}
                {activitySlice.map(([date, count], i) => {
                  const x = padLeft + i * (barWidth + barGap)
                  const h = ((count as number) / maxActivity) * (chartH - padTop - padBottom)
                  const isToday = date === todayStr
                  const isHovered = hoveredBar === i
                  return (
                    <g
                      key={date}
                      className="animate-bar"
                      style={{ transformOrigin: `${x + barWidth / 2}px ${chartH - padBottom}px` }}
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <rect
                        x={x}
                        y={chartH - padBottom - h}
                        width={barWidth}
                        height={h}
                        rx={2}
                        fill={isToday ? 'var(--chart-muted)' : 'var(--chart-ink)'}
                        opacity={isHovered ? 1 : (isToday ? 0.9 : 0.7)}
                        className="transition-all-expo"
                        style={{ cursor: 'pointer' }}
                      />
                      {/* Value above bar */}
                      <text
                        x={x + barWidth / 2}
                        y={chartH - padBottom - h - 5}
                        textAnchor="middle"
                        fill={isHovered ? 'var(--chart-ink)' : 'var(--chart-label)'}
                        fontSize={isHovered ? 10 : 9}
                        fontWeight={isHovered ? '600' : '400'}
                        className="transition-all-expo"
                      >
                        {count as number}
                      </text>
                      {/* Today indicator dot on line */}
                      {isToday && (
                        <circle
                          cx={x + barWidth / 2}
                          cy={chartH - padBottom - h}
                          r={3}
                          fill="var(--chart-ink)"
                        />
                      )}
                    </g>
                  )
                })}

                {/* Day labels */}
                {activitySlice.map(([date, _], i) => {
                  const x = padLeft + i * (barWidth + barGap) + barWidth / 2
                  const d = new Date(date)
                  const isToday = date === todayStr
                  return (
                    <text
                      key={`lbl-${date}`}
                      x={x}
                      y={chartH - 3}
                      textAnchor="middle"
                      fill={isToday ? 'var(--chart-ink)' : 'var(--chart-day-label)'}
                      fontSize={8}
                      fontWeight={isToday ? '600' : '400'}
                    >
                      {dayNames[d.getDay()]}
                    </text>
                  )
                })}
              </svg>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[150px] text-xs text-muted">
              No activity data in this range
            </div>
          )}
        </div>
      </div>

      {/* Stage Breakdown — Total/New Today/Pending Events already live in the
          Total Pipeline card above; repeating them here was pure duplication.
          Each card's stage-color dot matches its badge everywhere else in the
          app (Recent Leads below, Pipeline board, the funnel and outcome bar). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Contact', stage: 'Contact', value: filteredStats.byStage?.Contact || 0 },
          { label: 'Prospects', stage: 'Prospect', value: filteredStats.byStage?.Prospect || 0 },
          { label: 'Conv. Leads', stage: 'ConversionLead', value: filteredStats.byStage?.ConversionLead || 0 },
          { label: 'Purchases', stage: 'Purchase', value: filteredStats.byStage?.Purchase || 0 },
          { label: 'Not Qualified', stage: 'NotQualified', value: filteredStats.byStage?.NotQualified || 0 },
        ].map((card) => (
          <div key={card.label} className="kpi-card">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STAGE_COLOR_VAR[card.stage] }} />
              <p className="text-[10px] text-muted font-medium uppercase tracking-wider">{card.label}</p>
            </div>
            <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums tracking-tight leading-none">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Lead Journey Funnel (cumulative) */}
      <div className="border border-card-border rounded-xl p-6 transition-all-expo hover:border-[#d4d4d4]">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 mb-1">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a]">Lead Journey</h2>
          <span className="text-[10px] text-[#5f5f5f]">Cumulative — each step counts every lead that reached at least that far</span>
        </div>
        <p className="text-[10px] text-[#5f5f5f] mb-5">
          {journey.total} leads received · {journey.contacted} actually spoken to · {journey.meetingBooked} meetings booked
        </p>

        {/* The funnel silhouette does the explaining: each band's width is that
            step's share of all leads, so the taper *is* the drop-off. */}
        {(() => {
          const BAND = 52
          const GAP = 3
          const steps = journey.steps
          const H = steps.length * BAND
          // Same stage-color tokens as everywhere else (Recent Leads badges,
          // Pipeline board, the KPI dots above): Leads received/Attempted are
          // still pre-contact so both read as "Lead".
          const colors = [
            STAGE_COLOR_VAR.Lead,
            STAGE_COLOR_VAR.Lead,
            STAGE_COLOR_VAR.Contact,
            STAGE_COLOR_VAR.Prospect,
            STAGE_COLOR_VAR.ConversionLead,
            STAGE_COLOR_VAR.Purchase,
          ]
          const half = (c: number) => {
            const p = journey.total > 0 ? (c / journey.total) * 100 : 0
            return Math.max(p / 2, c > 0 ? 1.2 : 0.35)
          }
          return (
            <div className="flex items-stretch overflow-x-auto" style={{ height: H }}>
              {/* Left gutter: what the step is */}
              <div className="w-[100px] sm:w-[170px] shrink-0">
                {steps.map((s, i) => {
                  const prev = i > 0 ? steps[i - 1].count : s.count
                  const stepConv = i > 0 && prev > 0 ? Math.round((s.count / prev) * 100) : null
                  return (
                    <div key={s.key} className="flex flex-col justify-center" style={{ height: BAND }}>
                      <span className="text-[12px] sm:text-[13px] font-semibold text-[#0a0a0a] leading-tight">{s.label}</span>
                      {stepConv !== null && (
                        <span className="text-[10px] text-[#5f5f5f] tabular-nums leading-tight">{stepConv}% of prev.</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* The funnel itself — width of each band is that step's share of all leads */}
              <div className="flex-1 min-w-[60px] px-3">
                <svg
                  viewBox={`0 0 100 ${H}`}
                  preserveAspectRatio="none"
                  className="w-full block"
                  style={{ height: H }}
                  aria-hidden="true"
                >
                  {steps.map((s, i) => {
                    const y0 = i * BAND
                    const y1 = y0 + BAND - GAP
                    const topH = half(s.count)
                    const botH = half(i < steps.length - 1 ? steps[i + 1].count : s.count)
                    return (
                      <path
                        key={s.key}
                        d={`M ${50 - topH} ${y0} L ${50 + topH} ${y0} L ${50 + botH} ${y1} L ${50 - botH} ${y1} Z`}
                        fill={colors[i]}
                      />
                    )
                  })}
                </svg>
              </div>

              {/* Right gutter: how many, and who was lost getting here */}
              <div className="w-[110px] sm:w-[230px] shrink-0">
                {steps.map((s) => {
                  const pctOfTotal = journey.total > 0 ? (s.count / journey.total) * 100 : 0
                  return (
                    <div key={s.key} className="flex items-center justify-end gap-1.5 sm:gap-2" style={{ height: BAND }}>
                      {s.lost > 0 && (
                        <span className="hidden sm:inline text-[10px] text-red-600 tabular-nums text-right leading-tight">
                          −{s.lost} {s.lostLabel}
                        </span>
                      )}
                      <span className="text-[15px] sm:text-[17px] font-bold text-[#0a0a0a] tabular-nums">{s.count}</span>
                      <span className="text-[10px] text-[#5f5f5f] tabular-nums w-7 sm:w-8 text-right">
                        {pctOfTotal.toFixed(0)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Where every lead currently stands — one bar, sums to the full set,
            so "still in play" is visible against everything already lost. */}
        {(() => {
          // Same stage-color tokens as the rest of the page. NotQualified and
          // Invalid intentionally share a color here too — that's not a bug,
          // it's the same equivalence the .stage-NotQualified/.stage-Invalid
          // badges already encode everywhere else; the count labels below the
          // bar are what disambiguate them, not the color.
          // Strict partition by current stage (see the snap* fields in the
          // journey useMemo above) — every lead lands in exactly one segment,
          // including leads that were attempted but never had their stage
          // advanced off "Lead", so this always sums to journey.total.
          const segments = [
            { label: 'Still in play', value: journey.snapStillInPlay, color: STAGE_COLOR_VAR.Prospect },
            { label: 'Stalled at contact', value: journey.snapContact, color: STAGE_COLOR_VAR.Contact },
            { label: 'Not qualified', value: journey.snapNotQualified, color: STAGE_COLOR_VAR.NotQualified },
            { label: 'No response', value: journey.snapNoResponse, color: STAGE_COLOR_VAR.NoResponse },
            { label: 'Invalid / duplicate', value: journey.snapInvalid, color: STAGE_COLOR_VAR.Invalid },
            { label: 'Attempted, not staged', value: journey.snapLeadAttempted, color: STAGE_COLOR_VAR.Duplicate },
            { label: 'Never called', value: journey.snapLeadNeverCalled, color: STAGE_COLOR_VAR.Lead },
          ].filter((s) => s.value > 0)
          const sum = segments.reduce((n, s) => n + s.value, 0) || 1
          return (
            <div className="mt-6 pt-5 border-t border-card-border">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 mb-2.5">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a]">Where every lead stands</p>
                <span className="text-[10px] text-[#5f5f5f]">{journey.snapStillInPlay} of {journey.total} still in play</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-px">
                {segments.map((s) => (
                  <div
                    key={s.label}
                    style={{ width: `${(s.value / sum) * 100}%`, backgroundColor: s.color }}
                    title={`${s.label}: ${s.value}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                {segments.map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[11px] text-[#3d3d3d]">{s.label}</span>
                    <span className="text-[11px] font-semibold text-[#0a0a0a] tabular-nums">{s.value}</span>
                    <span className="text-[10px] text-[#5f5f5f] tabular-nums">
                      {((s.value / sum) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Stage Distribution — snapshot of where leads sit right now */}
      <div className="grid grid-cols-1 gap-5">
        <div className="border border-card-border rounded-xl p-6 transition-all-expo hover:border-[#d4d4d4]">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 mb-5">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a]">Current Stage Distribution</h2>
            <span className="text-[10px] text-muted">Snapshot — where each lead sits right now (not cumulative)</span>
          </div>
          <div className="space-y-3">
            {Object.entries(filteredStats.byStage).sort(([, a], [, b]) => (b as number) - (a as number)).map(([stage, count]) => {
              const pct = filteredStats.total > 0 ? Math.round(((count as number) / filteredStats.total) * 100) : 0
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#6b6b6b] w-20">{stageLabels[stage] || stage}</span>
                  <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: STAGE_COLOR_VAR[stage] || 'var(--stage-lead)' }}
                    />
                  </div>
                  <div className="flex items-center gap-2 min-w-[60px] justify-end">
                    <span className="text-xs font-semibold text-[#0a0a0a] tabular-nums">{count as number}</span>
                    <span className="text-[10px] text-muted tabular-nums w-10 text-right">{pct}%</span>
                  </div>
                </div>
              )
            })}
            {Object.keys(filteredStats.byStage).length === 0 && (
              <p className="text-xs text-muted py-8 text-center">No data in this range</p>
            )}
          </div>
        </div>
      </div>

      {/* Ad Performance */}
      <div className="border border-card-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a]">Ad Performance</h2>
          <span className="text-[10px] text-muted tabular-nums">{byAdStats.length} ads</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-card-border bg-[#fafafa]">
                <th className="px-6 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Ad Name</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa] text-right">Total</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa] text-right">Contact</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa] text-right">Prospect</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa] text-right">Conv. Lead</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa] text-right">Purchase</th>
                <th className="py-2.5 pr-6 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa] text-right">Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {byAdStats.map((ad) => {
                const converted = (ad.byStage.ConversionLead || 0) + (ad.byStage.Purchase || 0)
                const rate = ad.total > 0 ? Math.round((converted / ad.total) * 100) : 0
                return (
                  <tr key={ad.adName} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-all-expo">
                    <td className="px-6 py-3 pr-4 font-medium text-[#0a0a0a] text-xs max-w-[260px] truncate" title={ad.adName}>{ad.adName}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-xs">{ad.total}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-xs text-muted">{ad.byStage.Contact || 0}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-xs text-muted">{ad.byStage.Prospect || 0}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-xs font-semibold text-[#0a0a0a]">{ad.byStage.ConversionLead || 0}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-xs font-semibold text-[#0a0a0a]">{ad.byStage.Purchase || 0}</td>
                    <td className="py-3 pr-6 text-right tabular-nums text-xs font-semibold">{rate}%</td>
                  </tr>
                )
              })}
              {byAdStats.length === 0 && (
                <tr><td colSpan={7} className="text-xs text-muted py-8 text-center">No data in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Leads (filtered) */}
      <div className="border border-card-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a]">Recent Leads</h2>
          <span className="text-[10px] text-muted tabular-nums">{filteredStats.total} leads in range</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-card-border bg-[#fafafa]">
                <th className="px-6 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Name</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Campaign</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Stage</th>
                <th className="py-2.5 pr-6 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Created</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredLeads]
                .sort((a, b) => getMetaCreated(b).localeCompare(getMetaCreated(a)))
                .slice(0, 8)
                .map((lead: any) => (
                <tr key={lead._id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-all-expo">
                  <td className="px-6 py-3 pr-4 font-medium text-[#0a0a0a] text-sm">{lead.name || '—'}</td>
                  <td className="py-3 pr-4 text-muted text-xs">{lead.campaignName || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={stageClass(lead.stage)}>
                      <span className={`w-1.5 h-1.5 rounded-full ${POSITIVE_STAGES.has(lead.stage) ? 'bg-white' : NEGATIVE_STAGES.has(lead.stage) ? 'bg-[#d4d4d4]' : 'bg-[#0a0a0a]'}`} />
                      {lead.stage}
                    </span>
                  </td>
                  <td className="py-3 pr-6 text-muted tabular-nums text-xs">
                    {getMetaCreated(lead) ? new Date(getMetaCreated(lead)).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Source Footer */}
      <div className="border border-card-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted mb-1">Data Source</p>
            <p className="text-xs text-[#6b6b6b]">
              Convex cloud <span className="text-[#d4d4d4]">·</span> {sourceOfTruth?.totalLeads || stats?.total || 0} leads
              <span className="text-[#d4d4d4]"> · Re-sync updates Meta/source fields only</span>
            </p>
            <p className="text-[10px] text-muted mt-0.5">Reporting uses Meta lead creation date.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-30" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-medium text-emerald-600">Live</span>
          </div>
        </div>
      </div>
    </div>
  )
}