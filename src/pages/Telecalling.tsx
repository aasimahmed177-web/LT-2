import { useState, useEffect, useMemo } from 'react'
import { getLeads, getCallActivities } from '../api'
import { useClient } from '../ClientContext'

// ─── Types ──────────────────────────────────────────────────────────

interface CallActivity {
  metaLeadId: string
  callPicked?: string
  interested?: string
  meetingScheduled?: string
  purchase?: string
  callComments?: string
  caller?: string
  adName?: string
  lastCallDate?: string
}

interface FunnelMetrics {
  total: number
  notAttempted: number
  attempted: number
  connected: number
  interested: number
  conversionLeads: number
  purchase: number
  noResponse: number
  notQualified: number
  invalid: number
}

interface CallerRow {
  caller: string
  total: number
  attempted: number
  connected: number
  interested: number
  conversionLeads: number
  noResponse: number
  notQualified: number
  invalid: number
}

interface AdRow {
  adName: string
  caller: string
  total: number
  attempted: number
  connected: number
  interested: number
  conversionLeads: number
  noResponse: number
  notQualified: number
  invalid: number
}

interface ReasonBucket {
  label: string
  count: number
  leads: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────

function determineCaller(adName: string): string {
  const lower = adName.toLowerCase()
  if (lower.includes("aparna")) return "Aparna"
  if (lower.includes("suganya")) return "Suganya"
  return "Unknown"
}

function bucketReason(comments: string): string {
  const c = comments.toLowerCase()
  if (c.includes("junk")) return "Junk lead"
  if (c.includes("wrong number")) return "Wrong number"
  if (c.includes("not interested")) return "Not interested"
  if (c.includes("no response") || c.includes("not connected")) return "No response"
  if (c.includes("switched off")) return "Switched off"
  if (c.includes("language")) return "Language problem"
  if (c.includes("follow") || c.includes("will update")) return "Follow-up needed"
  if (c.includes("meeting") || c.includes("zoom") || c.includes("face to face")) return "Meeting scheduled"
  if (c.trim()) return "Other"
  return ""
}

function pct(n: number, d: number): string {
  if (!d) return "—"
  return (n / d * 100).toFixed(1) + "%"
}

// ─── Main Component ────────────────────────────────────────────────

export default function Telecalling() {
  const { currentClientId } = useClient()
  const [leads, setLeads] = useState<any[]>([])
  const [activities, setActivities] = useState<CallActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [callerFilter, setCallerFilter] = useState("")
  const [adFilter, setAdFilter] = useState("")
  const [stageFilter, setStageFilter] = useState("")

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getLeads(currentClientId, { limit: 1000 }),
      getCallActivities(),
    ])
      .then(([leadsData, activitiesData]) => {
        const ls = leadsData.leads || []
        const acts = activitiesData.activities || []
        setLeads(ls)
        setActivities(acts)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentClientId])

  // Build lookup map for call activities by metaLeadId
  const activityMap = useMemo(() => {
    const map = new Map<string, CallActivity>()
    for (const a of activities) {
      if (a.metaLeadId) map.set(a.metaLeadId, a)
    }
    return map
  }, [activities])

  // Enrich leads with call activity data
  const enriched = useMemo(() => {
    // Only include leads that have call activity data or are in a non-Lead stage
    return leads.map((lead) => {
      const activity = activityMap.get(lead.metaLeadId)
      const adName = activity?.adName || lead.adName || ""
      const caller = activity?.caller || determineCaller(adName)
      return {
        ...lead,
        _activity: activity,
        _adName: adName,
        _caller: caller,
        _hasCallData: !!activity,
      }
    })
  }, [leads, activityMap])

  // Apply filters
  const filtered = useMemo(() => {
    return enriched.filter((l) => {
      if (callerFilter && l._caller !== callerFilter) return false
      if (adFilter && l._adName !== adFilter) return false
      if (stageFilter && l.stage !== stageFilter) return false
      return true
    })
  }, [enriched, callerFilter, adFilter, stageFilter])

  // Funnel calculations
  const metrics = useMemo((): FunnelMetrics => {
    const m: FunnelMetrics = { total: 0, notAttempted: 0, attempted: 0, connected: 0, interested: 0, conversionLeads: 0, purchase: 0, noResponse: 0, notQualified: 0, invalid: 0 }

    for (const l of filtered) {
      const a = l._activity
      const stage = l.stage
      m.total++

      const hasCallData = !!a
      const callPicked = a?.callPicked === "Yes"
      const callInterested = a?.interested === "Yes"
      const comments = a?.callComments || ""

      // Determine attempted: has call activity or stage indicates attempt was made
      const isAttempted = stage !== "Lead" || hasCallData
      // Determine connected: callPicked=Yes OR stage is positive
      const isConnected = callPicked || ["Contact", "Prospect", "ConversionLead", "Purchase", "NotQualified"].includes(stage) && stage !== "NoResponse" && stage !== "Invalid"
      // Determine interested: callInterested=Yes OR stage is Prospect+
      const isInterested = callInterested || ["Prospect", "ConversionLead", "Purchase"].includes(stage)
      const isConvLead = ["ConversionLead", "Purchase"].includes(stage)
      const isPurchase = stage === "Purchase" || a?.purchase === "Yes"
      const isNoResponse = stage === "NoResponse"
      const isNotQualified = stage === "NotQualified"
      const isInvalid = stage === "Invalid" || stage === "Duplicate" || comments.toLowerCase().includes("wrong number") || comments.toLowerCase().includes("junk")

      if (isAttempted) m.attempted++
      else m.notAttempted++
      if (isConnected) m.connected++
      if (isInterested) m.interested++
      if (isConvLead) m.conversionLeads++
      if (isPurchase) m.purchase++
      if (isNoResponse) m.noResponse++
      if (isNotQualified) m.notQualified++
      if (isInvalid) m.invalid++
    }
    return m
  }, [filtered])

  // Caller breakdown
  const callerData = useMemo(() => {
    const map = new Map<string, CallerRow>()
    for (const l of enriched) {
      const caller = l._caller
      if (!map.has(caller)) map.set(caller, { caller, total: 0, attempted: 0, connected: 0, interested: 0, conversionLeads: 0, noResponse: 0, notQualified: 0, invalid: 0 })
      const r = map.get(caller)!
      const a = l._activity
      const comments = a?.callComments || ""
      r.total++
      if (l.stage !== "Lead" || a) r.attempted++
      const isConnected = a?.callPicked === "Yes" || (["Contact", "Prospect", "ConversionLead", "Purchase", "NotQualified"].includes(l.stage) && l.stage !== "NoResponse" && l.stage !== "Invalid")
      if (isConnected) r.connected++
      if (a?.interested === "Yes" || ["Prospect", "ConversionLead", "Purchase"].includes(l.stage)) r.interested++
      if (["ConversionLead", "Purchase"].includes(l.stage)) r.conversionLeads++
      if (l.stage === "NoResponse") r.noResponse++
      if (l.stage === "NotQualified") r.notQualified++
      if (l.stage === "Invalid" || l.stage === "Duplicate" || comments.toLowerCase().includes("wrong number") || comments.toLowerCase().includes("junk")) r.invalid++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [enriched])

  // Ad breakdown
  const adData = useMemo(() => {
    const map = new Map<string, AdRow>()
    for (const l of enriched) {
      const adName = l._adName
      if (!adName) continue
      if (!map.has(adName)) map.set(adName, { adName, caller: l._caller, total: 0, attempted: 0, connected: 0, interested: 0, conversionLeads: 0, noResponse: 0, notQualified: 0, invalid: 0 })
      const r = map.get(adName)!
      const a = l._activity
      const comments = a?.callComments || ""
      r.total++
      if (l.stage !== "Lead" || a) r.attempted++
      const isConnected = a?.callPicked === "Yes" || (["Contact", "Prospect", "ConversionLead", "Purchase", "NotQualified"].includes(l.stage) && l.stage !== "NoResponse" && l.stage !== "Invalid")
      if (isConnected) r.connected++
      if (a?.interested === "Yes" || ["Prospect", "ConversionLead", "Purchase"].includes(l.stage)) r.interested++
      if (["ConversionLead", "Purchase"].includes(l.stage)) r.conversionLeads++
      if (l.stage === "NoResponse") r.noResponse++
      if (l.stage === "NotQualified") r.notQualified++
      if (l.stage === "Invalid" || l.stage === "Duplicate" || comments.toLowerCase().includes("wrong number") || comments.toLowerCase().includes("junk")) r.invalid++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [enriched])

  // Reason buckets from call comments
  const reasonBuckets = useMemo(() => {
    const map = new Map<string, ReasonBucket>()
    for (const l of enriched) {
      const a = l._activity
      const comments = a?.callComments || ""
      const bucket = bucketReason(comments)
      if (!bucket) continue
      if (!map.has(bucket)) map.set(bucket, { label: bucket, count: 0, leads: [] })
      const b = map.get(bucket)!
      b.count++
      b.leads.push(l.name || "Unknown")
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [enriched])

  // Unique values for filters
  const uniqueCallers = useMemo(() => Array.from(new Set(enriched.map((l) => l._caller))).sort(), [enriched])
  const uniqueAds = useMemo(() => Array.from(new Set(enriched.map((l) => l._adName).filter(Boolean))).sort(), [enriched])
  const uniqueStages = useMemo(() => Array.from(new Set(enriched.map((l) => l.stage))).sort(), [enriched])

  // Count leads with and without call data
  const withCallData = enriched.filter((l) => l._hasCallData).length

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted text-sm">Loading telecalling data...</div></div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Telecalling Funnel</h1>
        <p className="text-sm text-muted mt-0.5">
          Calling funnel analytics ({enriched.length} leads, {withCallData} with call data)
          {!withCallData && <span className="text-amber-600 ml-1">— No call data yet. Import via CSV Import page.</span>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-muted font-medium">Filters:</span>
        <select value={callerFilter} onChange={(e) => setCallerFilter(e.target.value)} className="text-xs border border-card-border rounded-md px-2.5 py-1.5 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo">
          <option value="">All callers</option>
          {uniqueCallers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={adFilter} onChange={(e) => setAdFilter(e.target.value)} className="text-xs border border-card-border rounded-md px-2.5 py-1.5 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo">
          <option value="">All ads</option>
          {uniqueAds.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="text-xs border border-card-border rounded-md px-2.5 py-1.5 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo">
          <option value="">All stages</option>
          {uniqueStages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(callerFilter || adFilter || stageFilter) && (
          <button onClick={() => { setCallerFilter(""); setAdFilter(""); setStageFilter("") }} className="text-[11px] text-muted hover:text-[#0a0a0a] underline">Clear</button>
        )}
      </div>

      {/* Funnel Visualization */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <div className="px-5 py-3 border-b border-card-border bg-[#fafafa]">
          <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Funnel</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-0">
            {[
              { label: "Total", value: metrics.total, color: "bg-[#0a0a0a]" },
              { label: "Attempted", value: metrics.attempted, color: "bg-[#2a2a2a]" },
              { label: "Connected", value: metrics.connected, color: "bg-[#4a4a4a]" },
              { label: "Interested", value: metrics.interested, color: "bg-[#6a6a6a]" },
              { label: "Conv. Lead", value: metrics.conversionLeads, color: "bg-[#8a8a8a]" },
              { label: "Purchase", value: metrics.purchase || 0, color: "bg-[#aaaaaa]" },
            ].map((s) => {
              const pctVal = metrics.total ? s.value / metrics.total : 0
              return (
                <div key={s.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full mx-1 rounded-lg overflow-hidden" style={{ height: `${Math.max(pctVal * 120, 8)}px`, backgroundColor: s.color, opacity: pctVal > 0 ? 1 : 0.15 }} />
                  <span className="text-lg font-bold tabular-nums">{s.value}</span>
                  <span className="text-[10px] text-muted uppercase tracking-wider">{s.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Funnel Table */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-card-border bg-[#fafafa]">
              <th className="px-5 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Stage</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Count</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">% of Total</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">% of Previous</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Total Leads", value: metrics.total, prev: metrics.total },
              { label: "Call Attempted", value: metrics.attempted, prev: metrics.total },
              { label: "Connected", value: metrics.connected, prev: metrics.attempted },
              { label: "Interested", value: metrics.interested, prev: metrics.connected },
              { label: "Conversion Lead", value: metrics.conversionLeads, prev: metrics.interested },
              { label: "Purchase", value: metrics.purchase, prev: metrics.conversionLeads },
            ].map((row) => (
              <tr key={row.label} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-all-expo">
                <td className="px-5 py-3 font-medium text-[#0a0a0a] text-sm">{row.label}</td>
                <td className="py-3 tabular-nums font-semibold">{row.value}</td>
                <td className="py-3 tabular-nums text-muted">{pct(row.value, metrics.total)}</td>
                <td className="py-3 tabular-nums text-muted">{pct(row.value, row.prev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Leads", value: metrics.total },
          { label: "Not Attempted", value: metrics.notAttempted },
          { label: "Attempted", value: metrics.attempted, sub: pct(metrics.attempted, metrics.total), subLabel: "Attempt Rate" },
          { label: "Connected", value: metrics.connected, sub: pct(metrics.connected, metrics.attempted), subLabel: "Connect Rate" },
          { label: "Interested", value: metrics.interested, sub: pct(metrics.interested, metrics.connected), subLabel: "Interest Rate" },
          { label: "Conv. Leads", value: metrics.conversionLeads, sub: pct(metrics.conversionLeads, metrics.interested), subLabel: "Meeting Rate" },
          { label: "No Response", value: metrics.noResponse, sub: pct(metrics.noResponse, metrics.attempted), subLabel: "No-Resp Rate" },
          { label: "Not Qualified", value: metrics.notQualified, sub: pct(metrics.notQualified, metrics.connected), subLabel: "NQ Rate" },
          { label: "Invalid", value: metrics.invalid, sub: pct(metrics.invalid, metrics.total), subLabel: "Invalid Rate" },
          { label: "Purchase", value: metrics.purchase, sub: pct(metrics.purchase, metrics.conversionLeads), subLabel: "Purchase Rate" },
        ].map((card) => (
          <div key={card.label} className="kpi-card">
            <p className="text-[10px] text-muted font-medium uppercase tracking-wider">{card.label}</p>
            <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums tracking-tight leading-none">{card.value}</p>
            {card.sub && (
              <p className="text-xs text-muted mt-1">{card.sub} <span className="text-[9px]">({card.subLabel})</span></p>
            )}
          </div>
        ))}
      </div>

      {/* Caller Breakdown */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <div className="px-5 py-3 border-b border-card-border bg-[#fafafa]">
          <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Caller Breakdown</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-card-border bg-[#fafafa]">
              <th className="px-5 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Caller</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Total</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Attempted</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Attempt %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Connected</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Connect %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Interested</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Interest %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Conv. Leads</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Meeting %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">No Resp.</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">NQ</th>
              <th className="py-2.5 pr-5 text-[11px] uppercase tracking-writer font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Invalid</th>
            </tr>
          </thead>
          <tbody>
            {callerData.map((r) => (
              <tr key={r.caller} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-all-expo">
                <td className="px-5 py-3 font-medium text-[#0a0a0a] text-sm">{r.caller}</td>
                <td className="py-3 tabular-nums font-semibold">{r.total}</td>
                <td className="py-3 tabular-nums">{r.attempted}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.attempted, r.total)}</td>
                <td className="py-3 tabular-nums">{r.connected}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.connected, r.attempted)}</td>
                <td className="py-3 tabular-nums">{r.interested}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.interested, r.connected)}</td>
                <td className="py-3 tabular-nums">{r.conversionLeads}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.conversionLeads, r.interested)}</td>
                <td className="py-3 tabular-nums text-muted">{r.noResponse}</td>
                <td className="py-3 tabular-nums text-muted">{r.notQualified}</td>
                <td className="py-3 pr-5 tabular-nums text-muted">{r.invalid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ad Breakdown */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <div className="px-5 py-3 border-b border-card-border bg-[#fafafa]">
          <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Ad Breakdown</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-card-border bg-[#fafafa]">
              <th className="px-5 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Ad Name</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Caller</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Total</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Attempt %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Connect %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Interest %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Conv. Leads</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">No Resp.</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">NQ</th>
              <th className="py-2.5 pr-5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Invalid</th>
            </tr>
          </thead>
          <tbody>
            {adData.map((r) => (
              <tr key={r.adName} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-all-expo">
                <td className="px-5 py-3 font-medium text-[#0a0a0a] text-sm max-w-[200px] truncate" title={r.adName}>{r.adName}</td>
                <td className="py-3 text-muted text-xs">{r.caller}</td>
                <td className="py-3 tabular-nums font-semibold">{r.total}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.attempted, r.total)}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.connected, r.attempted)}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.interested, r.connected)}</td>
                <td className="py-3 tabular-nums">{r.conversionLeads}</td>
                <td className="py-3 tabular-nums text-muted">{r.noResponse}</td>
                <td className="py-3 tabular-nums text-muted">{r.notQualified}</td>
                <td className="py-3 pr-5 tabular-nums text-muted">{r.invalid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reason Buckets */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <div className="px-5 py-3 border-b border-card-border bg-[#fafafa]">
          <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Reason Buckets (from Call Comments)</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-card-border bg-[#fafafa]">
              <th className="px-5 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Reason</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Count</th>
              <th className="py-2.5 pr-5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Leads</th>
            </tr>
          </thead>
          <tbody>
            {reasonBuckets.length === 0 ? (
              <tr><td colSpan={3} className="px-5 py-6 text-center text-muted text-xs">No comments to bucket. Import call data via CSV Import page.</td></tr>
            ) : reasonBuckets.map((b) => (
              <tr key={b.label} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-all-expo">
                <td className="px-5 py-3 font-medium text-[#0a0a0a] text-sm">{b.label}</td>
                <td className="py-3 tabular-nums font-semibold">{b.count}</td>
                <td className="py-3 pr-5 text-muted text-xs max-w-[400px] truncate" title={b.leads.join(", ")}>
                  {b.leads.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}