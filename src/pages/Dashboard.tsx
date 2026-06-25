import { useState, useEffect, useMemo } from 'react'
import { getStats, getLeads, getSourceOfTruth } from '../api'
import { useClient } from '../ClientContext'

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
  const { currentClientId } = useClient()
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

  const load = () => {
    setLoading(true)
    Promise.all([
      getStats(currentClientId),
      getLeads(currentClientId),
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
      // Date range
      if (!isInRange(getMetaCreated(lead), dateRange)) return false
      // Stage
      if (stageFilter && lead.stage !== stageFilter) return false
      // Campaign
      if (campaignFilter && lead.campaignName !== campaignFilter) return false
      // Form
      if (formFilter && lead.formName !== formFilter) return false
      // Source
      if (sourceFilter && lead.platform !== sourceFilter) return false
      // Test/real toggle
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

  const barGap = activitySlice.length > 14 ? 1 : 2
  const chartW = 600
  const chartH = 140
  const barCount = activitySlice.length
  const barWidth = Math.min(28, Math.max(8, (chartW - barCount * barGap) / barCount))

  const FilterSelect = ({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2.5 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors min-w-[100px]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">LeadTrace CRM overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]" />
          <span>Live</span>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setDatePreset(p.label)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              datePreset === p.label
                ? 'bg-[#0a0a0a] text-white'
                : 'bg-white border border-card-border text-muted hover:text-[#0a0a0a]'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setDatePreset('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            datePreset === 'all'
              ? 'bg-[#0a0a0a] text-white'
              : 'bg-white border border-card-border text-muted hover:text-[#0a0a0a]'
          }`}
        >
          All time
        </button>
        <button
          onClick={() => setDatePreset('custom')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            datePreset === 'custom'
              ? 'bg-[#0a0a0a] text-white'
              : 'bg-white border border-card-border text-muted hover:text-[#0a0a0a]'
          }`}
        >
          Custom
        </button>
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 px-2 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a]"
            />
            <span className="text-xs text-muted">—</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 px-2 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a]"
            />
          </div>
        )}
      </div>

      {/* Other Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={stageFilter} onChange={setStageFilter} options={filterOptions.stages} placeholder="All stages" />
        <FilterSelect value={campaignFilter} onChange={setCampaignFilter} options={filterOptions.campaigns} placeholder="All campaigns" />
        <FilterSelect value={formFilter} onChange={setFormFilter} options={filterOptions.forms} placeholder="All forms" />
        <FilterSelect value={sourceFilter} onChange={setSourceFilter} options={filterOptions.sources} placeholder="All sources" />
        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTestLeads}
            onChange={(e) => setShowTestLeads(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-card-border accent-[#0a0a0a]"
          />
          Show test leads
        </label>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted hover:text-[#0a0a0a] transition-colors ml-1 underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Hero Bento: Total Pipeline + Activity Chart */}
      <div className="grid grid-cols-[1fr_2fr] gap-6">
        {/* Pipeline stat card */}
        <div className="border border-card-border rounded-lg p-6 flex flex-col justify-between">
          <div>
            <p className="section-label">Total Pipeline</p>
            <p className="text-[42px] font-bold text-[#0a0a0a] mt-2 tabular-nums tracking-tight leading-none">
              {filteredStats.total}
            </p>
            {!hasFilters && <p className="text-sm text-muted mt-2">{stats.last24h} in last 24h</p>}
            {hasFilters && <p className="text-sm text-muted mt-2">Filtered</p>}
          </div>
          <div className="flex gap-4 mt-6 pt-6 border-t border-card-border">
            {[
              { label: 'New today', value: stats.newToday },
              { label: 'Pending events', value: stats.pendingCrmEvents },
            ].map((c) => (
              <div key={c.label}>
                <p className="text-[22px] font-bold text-[#0a0a0a] tabular-nums">{c.value}</p>
                <p className="text-[11px] text-muted mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity chart */}
        <div className="border border-card-border rounded-lg p-6">
          <p className="section-label">Lead Activity</p>
          <p className="text-[11px] text-muted mt-0.5 mb-4">{datePreset === 'all' ? 'All time' : `Last ${activitySlice.length} days`}</p>
          {activitySlice.length > 0 ? (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" style={{ height: chartH }}>
              {/* Grid lines */}
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <line
                  key={pct}
                  x1={0} y1={chartH - chartH * pct}
                  x2={chartW} y2={chartH - chartH * pct}
                  stroke="#ebebeb" strokeWidth={1}
                />
              ))}
              {/* Bars */}
              {activitySlice.map(([date, count], i) => {
                const x = i * (barWidth + barGap) + 10
                const h = ((count as number) / maxActivity) * (chartH - 20)
                return (
                  <g key={date} className="animate-bar" style={{ transformOrigin: `0 ${chartH}px` }}>
                    <rect
                      x={x}
                      y={chartH - 10 - h}
                      width={barWidth}
                      height={h}
                      rx={2}
                      fill="#0a0a0a"
                      opacity={0.85}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={chartH - 18 - h}
                      textAnchor="middle"
                      fill="#6b6b6b"
                      fontSize={10}
                    >
                      {count as number}
                    </text>
                  </g>
                )
              })}
              {/* Day labels */}
              {activitySlice.map(([date, _], i) => {
                const x = i * (barWidth + barGap) + 10 + barWidth / 2
                const d = new Date(date)
                return (
                  <text
                    key={`lbl-${date}`}
                    x={x}
                    y={chartH - 2}
                    textAnchor="middle"
                    fill="#9e9e9e"
                    fontSize={9}
                  >
                    {dayNames[d.getDay()]}
                  </text>
                )
              })}
            </svg>
          ) : (
            <div className="text-sm text-muted">No activity data in this range</div>
          )}
        </div>
      </div>

      {/* Stats Cards Grid — 8 bento cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: filteredStats.total },
          { label: 'New Today', value: stats.newToday },
          { label: 'Contact', value: filteredStats.byStage?.Contact || 0 },
          { label: 'Prospects', value: filteredStats.byStage?.Prospect || 0 },
          { label: 'Conv. Leads', value: filteredStats.byStage?.ConversionLead || 0 },
          { label: 'Purchases', value: filteredStats.byStage?.Purchase || 0 },
          { label: 'Pending Events', value: stats.pendingCrmEvents },
          { label: 'Not Qualified', value: filteredStats.byStage?.NotQualified || 0 },
        ].map((card) => (
          <div key={card.label} className="border border-card-border rounded-lg p-4 hover:border-[#d4d4d4] transition-colors">
            <p className="text-[11px] text-muted font-medium">{card.label}</p>
            <p className="text-[26px] font-bold text-[#0a0a0a] mt-1 tabular-nums tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Funnel + Stage Distribution */}
      <div className="grid grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <div className="border border-card-border rounded-lg p-5">
          <h2 className="text-[13px] font-semibold text-[#0a0a0a] mb-5">Pipeline Funnel</h2>
          <div className="space-y-4">
            {stageOrder.map((stage) => {
              const entry = filteredStats.funnel.find((f: any) => f.stage === stage)
              const count = entry?.count || 0
              const pct = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#6b6b6b] font-medium">{stageLabels[stage]}</span>
                    <span className="text-[#0a0a0a] font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full funnel-bar bg-[#0a0a0a]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stage Distribution */}
        <div className="border border-card-border rounded-lg p-5">
          <h2 className="text-[13px] font-semibold text-[#0a0a0a] mb-5">Stage Distribution</h2>
          <div className="space-y-3">
            {Object.entries(filteredStats.byStage).sort(([, a], [, b]) => (b as number) - (a as number)).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs font-medium text-[#6b6b6b] w-20">{stageLabels[stage] || stage}</span>
                <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0a0a0a]"
                    style={{ width: `${((count as number) / filteredStats.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#0a0a0a] w-8 text-right tabular-nums">{count as number}</span>
              </div>
            ))}
            {Object.keys(filteredStats.byStage).length === 0 && (
              <p className="text-xs text-muted">No data in this range</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Leads (filtered) */}
      <div className="border border-card-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[#0a0a0a]">Recent Leads</h2>
          <span className="text-xs text-muted">{filteredStats.total} in range</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs border-b border-card-border">
                <th className="pb-2.5 font-medium text-muted">Name</th>
                <th className="pb-2.5 font-medium text-muted">Campaign</th>
                <th className="pb-2.5 font-medium text-muted">Stage</th>
                <th className="pb-2.5 font-medium text-muted">Created</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredLeads]
                .sort((a, b) => getMetaCreated(b).localeCompare(getMetaCreated(a)))
                .slice(0, 8)
                .map((lead: any) => (
                <tr key={lead._id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-[#0a0a0a]">{lead.name || '—'}</td>
                  <td className="py-2.5 pr-4 text-muted">{lead.campaignName || '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]" />
                      {lead.stage}
                    </span>
                  </td>
                  <td className="py-2.5 text-muted tabular-nums text-xs">
                    {getMetaCreated(lead) ? new Date(getMetaCreated(lead)).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Source Footer */}
      <div className="border border-card-border rounded-lg p-5 text-sm text-muted">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest font-medium text-muted mb-1">Data Source</p>
            <p>
              Convex cloud <span className="text-[#d4d4d4]">·</span> {sourceOfTruth?.totalLeads || stats.total} leads
              <span className="text-[#d4d4d4]"> · Re-sync updates Meta/source fields only</span>
            </p>
            <p className="text-xs text-muted mt-0.5">Reporting uses Meta lead creation date.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]" />
            <span className="text-muted">Live</span>
          </div>
        </div>
      </div>
    </div>
  )
}