import { useMemo } from 'react'

const STAGE_LABELS: Record<string, string> = {
  Lead: 'Lead',
  Contact: 'Contact',
  Prospect: 'Prospect',
  ConversionLead: 'Conv. Lead',
  Purchase: 'Purchase',
  NotQualified: 'Not Qualified',
  NoResponse: 'No Response',
  Duplicate: 'Duplicate',
  Invalid: 'Invalid',
}

const STAGE_ORDER = ['Lead', 'Contact', 'Prospect', 'ConversionLead', 'Purchase']

const NEGATIVE_STAGES = ['NotQualified', 'NoResponse', 'Duplicate', 'Invalid']

interface FunnelProps {
  leads: any[]
}

interface StageDetail {
  leads: any[]
  avgDays: number | null
}

export default function MarketingFunnel({ leads }: FunnelProps) {
  const funnel = useMemo(() => {
    const total = leads.length

    // Contacted = any lead not at "Lead" stage
    const contacted = leads.filter((l) => l.stage !== 'Lead')
    const notContacted = leads.filter((l) => l.stage === 'Lead')

    // Positive funnel: cumulative count of leads that reached at least this stage
    const positiveFunnel = STAGE_ORDER.filter((s) => s !== 'Lead').map((stage) => {
      const stageIdx = STAGE_ORDER.indexOf(stage)
      const reached = leads.filter((l) => {
        const leadIdx = STAGE_ORDER.indexOf(l.stage)
        return leadIdx >= stageIdx
      })
      return { stage, count: reached.length }
    })

    // Negative stages: direct counts
    const negativeBreakdown: Record<string, number> = {}
    for (const s of NEGATIVE_STAGES) {
      negativeBreakdown[s] = leads.filter((l) => l.stage === s).length
    }

    // Stage details with lead lists for drill-down
    const stageDetails: Record<string, StageDetail> = {}
    for (const stage of STAGE_ORDER) {
      stageDetails[stage] = {
        leads: leads.filter((l) => l.stage === stage),
        avgDays: null,
      }
    }
    for (const stage of NEGATIVE_STAGES) {
      stageDetails[stage] = {
        leads: leads.filter((l) => l.stage === stage),
        avgDays: null,
      }
    }

    // Calculate drop-off reasons from stage history (for leads not in positive funnel)
    const contactedCount = contacted.length
    const negativeTotal = Object.values(negativeBreakdown).reduce((a, b) => a + b, 0)

    return {
      total,
      contactedCount,
      notContactedCount: notContacted.length,
      notContactedLeads: notContacted,
      positiveFunnel,
      negativeBreakdown,
      negativeTotal,
      stageDetails,
      contactedLeads: contacted,
    }
  }, [leads])

  if (funnel.total === 0) {
    return (
      <div className="border border-card-border rounded-xl p-6">
        <p className="text-xs text-muted text-center py-8">No data to show funnel</p>
      </div>
    )
  }

  const maxFunnelCount = Math.max(funnel.total, 1)

  return (
    <div className="border border-card-border rounded-xl p-6 transition-all-expo hover:border-[#d4d4d4]">
      <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-5">Marketing Funnel</h2>

      {/* All Leads (top of funnel) */}
      <FunnelBar
        label="All Leads"
        count={funnel.total}
        pct={100}
        barColor="bg-[#0a0a0a]"
      />

      {/* Contacted vs Not Contacted split */}
      <div className="grid grid-cols-2 gap-3 mt-3 mb-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-emerald-900">Contacted</span>
            <span className="text-sm font-bold text-emerald-900 tabular-nums">{funnel.contactedCount}</span>
          </div>
          <div className="h-1.5 bg-emerald-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${(funnel.contactedCount / maxFunnelCount) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-emerald-700 mt-1">
            {funnel.total > 0 ? Math.round((funnel.contactedCount / funnel.total) * 100) : 0}% of total
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-amber-900">Not Contacted</span>
            <span className="text-sm font-bold text-amber-900 tabular-nums">{funnel.notContactedCount}</span>
          </div>
          <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-600 rounded-full transition-all duration-500"
              style={{ width: `${(funnel.notContactedCount / maxFunnelCount) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-amber-700 mt-1">
            {funnel.total > 0 ? Math.round((funnel.notContactedCount / funnel.total) * 100) : 0}% of total
          </p>
        </div>
      </div>

      {/* Positive Funnel */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider font-medium text-muted mb-3">Positive Journey</p>
        <div className="space-y-3">
          {funnel.positiveFunnel.map((stage, idx) => {
            const prevCount = idx > 0 ? funnel.positiveFunnel[idx - 1].count : funnel.total
            const conversion = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0
            const pct = (stage.count / maxFunnelCount) * 100
            return (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        idx === funnel.positiveFunnel.length - 1 ? 'bg-[#555555]' : 'bg-[#0a0a0a]'
                      }`}
                    />
                    <span className="text-xs font-medium text-[#6b6b6b]">
                      {STAGE_LABELS[stage.stage]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#0a0a0a] tabular-nums">{stage.count}</span>
                    <span className="text-[10px] text-emerald-600 font-medium tabular-nums">
                      {conversion}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: idx === funnel.positiveFunnel.length - 1 ? '#555555' : '#0a0a0a',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Negative Outcomes */}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-medium text-muted mb-3">Negative Outcomes</p>
        {NEGATIVE_STAGES.filter((s) => (funnel.negativeBreakdown[s] || 0) > 0).length > 0 ? (
          <div className="space-y-2.5">
            {NEGATIVE_STAGES.map((stage) => {
              const count = funnel.negativeBreakdown[stage] || 0
              if (count === 0) return null
              const pct = (count / funnel.total) * 100
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-muted">{STAGE_LABELS[stage]}</span>
                    <span className="text-[11px] font-semibold text-[#0a0a0a] tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#d4d4d4] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted py-3 text-center">No negative outcomes</p>
        )}
      </div>

      {/* Summary footer */}
      <div className="mt-4 pt-3 border-t border-card-border">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[18px] font-bold text-[#0a0a0a] tabular-nums">{funnel.contactedCount}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Contacted</p>
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#0a0a0a] tabular-nums">
              {funnel.positiveFunnel[funnel.positiveFunnel.length - 1]?.count || 0}
            </p>
            <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Converted</p>
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#0a0a0a] tabular-nums">{funnel.negativeTotal}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Lost</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function FunnelBar({
  label,
  count,
  pct,
  barColor,
}: {
  label: string
  count: number
  pct: number
  barColor: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[#0a0a0a]">{label}</span>
        <span className="text-xs font-bold text-[#0a0a0a] tabular-nums">{count}</span>
      </div>
      <div className="h-3 bg-[#f0f0f0] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}