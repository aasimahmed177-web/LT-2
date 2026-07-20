import { useState, useEffect, useMemo, useRef } from 'react'
import { getStats, getLeads, getSourceOfTruth } from '../api'
import { useClient } from '../ClientContext'
import { POSITIVE_STAGES, NEGATIVE_STAGES, stageClass } from '../constants'

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
    ])
      .then(([s, l, t]) => {
        setStats(s)
        setAllLeads(l.leads || [])
        setSourceOfTruth(t)
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

  const stageOrder = ['Lead', 'Contact', 'Prospect', 'ConversionLead', 'Purchase']
  const stageLabels: Record<string, string> = {
    Lead: 'Lead', Contact: 'Contact', Prospect: 'Prospect',
    ConversionLead: 'Conv. Lead', Purchase: 'Purchase',
  }

  const maxFunnel = Math.max(...stageOrder.map((s) => filteredStats.funnel.find((f: any) => f.stage === s)?.count || 0), 1)

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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
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
      <div className="grid grid-cols-[1fr_2fr] gap-5">
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
                    stroke="#f0f0f0" strokeWidth={1}
                  />
                ))}

                {/* Gradient fill for area */}
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0a0a0a" />
                    <stop offset="100%" stopColor="#555555" />
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
                        fill={isToday ? '#555555' : '#0a0a0a'}
                        opacity={isHovered ? 1 : (isToday ? 0.9 : 0.7)}
                        className="transition-all-expo"
                        style={{ cursor: 'pointer' }}
                      />
                      {/* Value above bar */}
                      <text
                        x={x + barWidth / 2}
                        y={chartH - padBottom - h - 5}
                        textAnchor="middle"
                        fill={isHovered ? '#0a0a0a' : '#a0a0a0'}
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
                          fill="#0a0a0a"
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
                      fill={isToday ? '#0a0a0a' : '#b0b0b0'}
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

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: filteredStats.total, secondary: stats?.last24h !== undefined ? `${stats.last24h} in 24h` : null },
          { label: 'New Today', value: stats?.newToday || 0, secondary: null },
          { label: 'Contact', value: filteredStats.byStage?.Contact || 0, secondary: null },
          { label: 'Prospects', value: filteredStats.byStage?.Prospect || 0, secondary: null },
          { label: 'Conv. Leads', value: filteredStats.byStage?.ConversionLead || 0, secondary: null },
          { label: 'Purchases', value: filteredStats.byStage?.Purchase || 0, secondary: null },
          { label: 'Pending Events', value: stats?.pendingCrmEvents || 0, secondary: null },
          { label: 'Not Qualified', value: filteredStats.byStage?.NotQualified || 0, secondary: null },
        ].map((card) => (
          <div
            key={card.label}
            className="kpi-card"
          >
            <p className="text-[10px] text-muted font-medium uppercase tracking-wider">{card.label}</p>
            <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums tracking-tight leading-none">{card.value}</p>
            {card.secondary && (
              <p className="text-[10px] text-muted mt-2">{card.secondary}</p>
            )}
          </div>
        ))}
      </div>

      {/* Funnel + Stage Distribution */}
      <div className="grid grid-cols-2 gap-5">
        {/* Pipeline Funnel */}
        <div className="border border-card-border rounded-xl p-6 transition-all-expo hover:border-[#d4d4d4]">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-5">Pipeline Funnel</h2>
          <div className="space-y-4">
            {stageOrder.map((stage, idx) => {
              const entry = filteredStats.funnel.find((f: any) => f.stage === stage)
              const count = entry?.count || 0
              const pct = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0
              const prevCount = idx > 0
                ? (filteredStats.funnel.find((f: any) => f.stage === stageOrder[idx - 1])?.count || 0)
                : count
              const conversion = idx > 0 && prevCount > 0 ? Math.round((count / prevCount) * 100) : null
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]" />
                      <span className="text-xs font-medium text-[#6b6b6b]">{stageLabels[stage]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#0a0a0a] tabular-nums">{count}</span>
                      {conversion !== null && (
                        <span className="text-[10px] text-muted tabular-nums">({conversion}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full funnel-bar-smooth"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: idx === stageOrder.length - 1 ? '#555555' : '#0a0a0a',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stage Distribution */}
        <div className="border border-card-border rounded-xl p-6 transition-all-expo hover:border-[#d4d4d4]">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-5">Stage Distribution</h2>
          <div className="space-y-3">
            {Object.entries(filteredStats.byStage).sort(([, a], [, b]) => (b as number) - (a as number)).map(([stage, count]) => {
              const pct = filteredStats.total > 0 ? Math.round(((count as number) / filteredStats.total) * 100) : 0
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#6b6b6b] w-20">{stageLabels[stage] || stage}</span>
                  <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${NEGATIVE_STAGES.has(stage) ? 'bg-[#d4d4d4]' : 'bg-[#0a0a0a]'}`}
                      style={{ width: `${pct}%` }}
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
        <div className="flex items-center justify-between">
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