import { useState, useEffect } from 'react'
import { getStats, getLeads, getSourceOfTruth } from '../api'

function getMetaCreated(lead: any): string {
  return lead?.fullResponse?.created_time || lead.ingestedAt || ''
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [recentLeads, setRecentLeads] = useState<any[]>([])
  const [sourceOfTruth, setSourceOfTruth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      getStats(),
      getLeads(),
      getSourceOfTruth(),
    ])
      .then(([s, l, t]) => {
        setStats(s)
        const sorted = (l.leads || [])
          .filter((lead: any) => !lead.name?.includes('test lead: dummy data'))
          .sort((a: any, b: any) => getMetaCreated(b).localeCompare(getMetaCreated(a)))
        setRecentLeads(sorted.slice(0, 8))
        setSourceOfTruth(t)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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

  const maxFunnel = Math.max(...stageOrder.map((s) => stats?.funnel?.find((f: any) => f.stage === s)?.count || 0), 1)

  const activityDates = stats?.activityByDate ? Object.entries(stats.activityByDate).sort() : []
  const maxActivity = Math.max(...activityDates.map(([, c]) => c as number), 1)
  const barGap = activityDates.length > 14 ? 1 : 2

  // SVG chart dimensions
  const chartW = 600
  const chartH = 140
  const barCount = activityDates.slice(-14).length
  const barWidth = Math.min(28, (chartW - barCount * barGap) / barCount)

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

      {/* Hero Bento: Total Pipeline + Activity Chart */}
      <div className="grid grid-cols-[1fr_2fr] gap-6">
        {/* Pipeline stat card */}
        <div className="border border-card-border rounded-lg p-6 flex flex-col justify-between">
          <div>
            <p className="section-label">Total Pipeline</p>
            <p className="text-[42px] font-bold text-[#0a0a0a] mt-2 tabular-nums tracking-tight leading-none">
              {stats.total}
            </p>
            <p className="text-sm text-muted mt-2">{stats.last24h} in last 24h</p>
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
          <p className="text-[11px] text-muted mt-0.5 mb-4">Last 14 days</p>
          {activityDates.length > 0 ? (
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
              {activityDates.slice(-14).map(([date, count], i) => {
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
              {activityDates.slice(-14).map(([date, _], i) => {
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
            <div className="text-sm text-muted">No activity data</div>
          )}
        </div>
      </div>

      {/* Stats Cards Grid — 8 bento cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: stats.total },
          { label: 'New Today', value: stats.newToday },
          { label: 'Contact', value: stats.byStage?.Contact || 0 },
          { label: 'Prospects', value: stats.byStage?.Prospect || 0 },
          { label: 'Conv. Leads', value: stats.byStage?.ConversionLead || 0 },
          { label: 'Purchases', value: stats.byStage?.Purchase || 0 },
          { label: 'Pending Events', value: stats.pendingCrmEvents },
          { label: 'Not Qualified', value: stats.byStage?.NotQualified || 0 },
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
              const entry = stats.funnel?.find((f: any) => f.stage === stage)
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
            {Object.entries(stats.byStage || {}).sort(([, a], [, b]) => (b as number) - (a as number)).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs font-medium text-[#6b6b6b] w-20">{stageLabels[stage] || stage}</span>
                <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0a0a0a]"
                    style={{ width: `${((count as number) / stats.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#0a0a0a] w-8 text-right tabular-nums">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="border border-card-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[#0a0a0a]">Recent Leads</h2>
          <span className="text-xs text-muted">{stats.total} total</span>
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
              {recentLeads.map((lead: any) => (
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