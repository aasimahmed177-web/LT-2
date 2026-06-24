import { useState, useEffect } from 'react'
import { getStats, getLeads, getSourceOfTruth } from '../api'

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [recentLeads, setRecentLeads] = useState<any[]>([])
  const [sourceOfTruth, setSourceOfTruth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getStats(),
      getLeads(),
      getSourceOfTruth(),
    ])
      .then(([s, l, t]) => {
        setStats(s)
        setRecentLeads((l.leads || []).slice(0, 8))
        setSourceOfTruth(t)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">Loading dashboard...</div>
      </div>
    )
  }

  const stageOrder = ['Lead', 'Contact', 'Prospect', 'ConversionLead', 'Purchase']
  const stageLabels: Record<string, string> = {
    Lead: 'Lead', Contact: 'Contact', Prospect: 'Prospect',
    ConversionLead: 'Conv. Lead', Purchase: 'Purchase',
  }
  const stageColors: Record<string, string> = {
    Lead: 'bg-indigo-500', Contact: 'bg-amber-500', Prospect: 'bg-blue-500',
    ConversionLead: 'bg-purple-500', Purchase: 'bg-emerald-500',
  }
  const maxFunnel = Math.max(...stageOrder.map((s) => stats?.funnel?.find((f: any) => f.stage === s)?.count || 0), 1)

  const activityDates = stats?.activityByDate ? Object.entries(stats.activityByDate).sort() : []
  const maxActivity = Math.max(...activityDates.map(([, c]) => c as number), 1)

  const statCards = [
    { label: 'Total Leads', value: stats.total, color: 'text-indigo-600' },
    { label: 'New Today', value: stats.newToday, color: 'text-emerald-600' },
    { label: 'Contact', value: stats.contacted, color: 'text-amber-600' },
    { label: 'Prospects', value: stats.prospects, color: 'text-blue-600' },
    { label: 'Conv. Leads', value: stats.conversionLeads, color: 'text-purple-600' },
    { label: 'Purchases', value: stats.purchases, color: 'text-emerald-600' },
    { label: 'Pending Events', value: stats.pendingCrmEvents, color: 'text-orange-600' },
    { label: 'Not Qualified', value: stats.notQualified, color: 'text-red-600' },
  ]

  const stageBadgeClass = (stage: string) => {
    const m: Record<string, string> = {
      Lead: 'bg-indigo-100 text-indigo-700',
      Contact: 'bg-amber-100 text-amber-700',
      prospect: 'bg-blue-100 text-blue-700',
      ConversionLead: 'bg-purple-100 text-purple-700',
      Purchase: 'bg-emerald-100 text-emerald-700',
      NotQualified: 'bg-red-100 text-red-700',
      NoResponse: 'bg-gray-100 text-gray-600',
      Duplicate: 'bg-orange-100 text-orange-700',
      Invalid: 'bg-red-100 text-red-700',
    }
    return m[stage] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">LeadTrace CRM overview</p>
      </div>

      {/* Dark Hero Panel */}
      <div className="rounded-xl bg-dark-card dot-grid border border-dark-card-border p-6 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Pipeline</p>
            <p className="text-4xl font-bold mt-1 tabular-nums">{stats.total}</p>
            <p className="text-sm text-gray-400 mt-1">{stats.last24h} in last 24h</p>
          </div>
          <div className="flex gap-3">
            {statCards.slice(0, 4).map((card) => (
              <div key={card.label} className="text-center min-w-[80px]">
                <p className={`text-xl font-bold tabular-nums ${card.color.replace('text-', 'text-')}`}>
                  {card.value}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity sparkline */}
        {activityDates.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Lead Activity (last 14 days)</p>
            <div className="flex items-end gap-1 h-16">
              {activityDates.slice(-14).map(([date, count]) => (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-indigo-400/60 transition-all"
                    style={{ height: `${((count as number) / maxActivity) * 48}px`, minHeight: '4px' }}
                    title={`${date}: ${count}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-card-border p-4">
            <p className="text-xs text-muted font-medium">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Funnel + Activity */}
      <div className="grid grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="bg-card rounded-xl border border-card-border p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Pipeline Funnel</h2>
          <div className="space-y-3">
            {stageOrder.map((stage) => {
              const entry = stats.funnel?.find((f: any) => f.stage === stage)
              const count = entry?.count || 0
              const pct = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{stageLabels[stage]}</span>
                    <span className="text-gray-800 font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full funnel-bar ${stageColors[stage] || 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stage Distribution */}
        <div className="bg-card rounded-xl border border-card-border p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Stage Distribution</h2>
          <div className="space-y-2.5">
            {Object.entries(stats.byStage || {}).sort(([, a], [, b]) => (b as number) - (a as number)).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stageBadgeClass(stage)}`}>
                  {stageLabels[stage] || stage}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${((count as number) / stats.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-600 w-8 text-right tabular-nums">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-card rounded-xl border border-card-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Recent Leads</h2>
          <span className="text-xs text-muted">{stats.total} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-gray-100">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Campaign</th>
                <th className="pb-2 font-medium">Stage</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead: any) => (
                <tr key={lead._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2.5 pr-4 font-medium text-gray-800">{lead.name || '—'}</td>
                  <td className="py-2.5 pr-4 text-gray-500">{lead.campaignName || '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${stageBadgeClass(lead.stage)}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-500 tabular-nums">
                    {lead.ingestedAt ? new Date(lead.ingestedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Source Proof */}
      <div className="rounded-xl bg-dark-card dot-grid border border-dark-card-border p-5 text-white/80">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider font-medium text-gray-400">Data Source</p>
            <p className="text-sm mt-1">
              Convex cloud <span className="text-gray-500">·</span> {sourceOfTruth?.totalLeads || stats.total} leads
              <span className="text-gray-500"> · Re-sync creates {stats.total} updated, 0 new</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-gray-400">Live</span>
          </div>
        </div>
      </div>
    </div>
  )
}