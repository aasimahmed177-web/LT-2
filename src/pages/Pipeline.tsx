import { useState, useEffect, useMemo } from 'react'
import { getLeads, updateLeadStage } from '../api'
import { useClient } from '../ClientContext'
import LeadDrawer from '../LeadDrawer'
import { STAGES } from '../constants'

function getMetaCreated(lead: any): string {
  return lead?.fullResponse?.created_time || lead.ingestedAt || ''
}

function isTestLead(lead: any): boolean {
  return !!lead?.name?.includes('test lead: dummy data')
}

// Per-stage accent color for the kanban column headers. Funnel stages warm to
// "converted" green; disqualified stages are muted grey/red.
const STAGE_ACCENT: Record<string, string> = {
  Lead: '#94a3b8',
  Contact: '#60a5fa',
  Prospect: '#818cf8',
  ConversionLead: '#a78bfa',
  Purchase: '#34d399',
  NotQualified: '#f87171',
  NoResponse: '#cbd5e1',
  Duplicate: '#fbbf24',
  Invalid: '#9ca3af',
}

export default function Pipeline() {
  const { currentClientId, currentClient } = useClient()
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showTestLeads, setShowTestLeads] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getLeads(currentClientId, { limit: 500 })
      .then((data) => setAllLeads(data.leads || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [currentClientId])

  const visibleLeads = useMemo(() => {
    let result = allLeads
    if (!showTestLeads) result = result.filter((l) => !isTestLead(l))
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.phone && l.phone.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.campaignName && l.campaignName.toLowerCase().includes(q))
      )
    }
    return result
  }, [allLeads, showTestLeads, search])

  const byStage = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const s of STAGES) map[s.key] = []
    for (const l of visibleLeads) {
      if (!map[l.stage]) map[l.stage] = []
      map[l.stage].push(l)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => getMetaCreated(b).localeCompare(getMetaCreated(a)))
    }
    return map
  }, [visibleLeads])

  const moveLeadToStage = async (leadId: string, newStage: string) => {
    const lead = allLeads.find((l) => l._id === leadId)
    if (!lead || lead.stage === newStage) return

    // Optimistic move
    const prevStage = lead.stage
    setAllLeads((prev) => prev.map((l) => (l._id === leadId ? { ...l, stage: newStage } : l)))
    setSavingId(leadId)
    try {
      await updateLeadStage(leadId, newStage)
    } catch (e) {
      // Roll back on failure
      setAllLeads((prev) => prev.map((l) => (l._id === leadId ? { ...l, stage: prevStage } : l)))
      console.error('Stage move failed:', e)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted mt-0.5">
            {currentClient?.name || 'LeadTrace CRM'} · drag cards between stages to update
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email, campaign…"
          className="h-8 px-3 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] placeholder-muted/60 focus:outline-none focus:border-[#0a0a0a] transition-all-expo min-w-[260px]"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={showTestLeads}
            onChange={(e) => setShowTestLeads(e.target.checked)}
            className="w-3 h-3 rounded border-card-border accent-[#0a0a0a]"
          />
          Show tests
        </label>
        <span className="text-[11px] text-muted ml-auto tabular-nums">{visibleLeads.length} leads</span>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>
      )}

      {/* Board */}
      {loading ? (
        <div className="p-10 text-center text-sm text-muted">Loading pipeline…</div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STAGES.map((s) => {
              const cards = byStage[s.key] || []
              const accent = STAGE_ACCENT[s.key] || '#94a3b8'
              const isDropTarget = dragOverStage === s.key
              return (
                <div
                  key={s.key}
                  onDragOver={(e) => { e.preventDefault(); setDragOverStage(s.key) }}
                  onDragLeave={() => setDragOverStage((cur) => (cur === s.key ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('text/plain') || dragId
                    if (id) moveLeadToStage(id, s.key)
                    setDragId(null)
                    setDragOverStage(null)
                  }}
                  className={`w-[260px] shrink-0 rounded-xl border transition-all-expo ${
                    isDropTarget ? 'border-[#0a0a0a] bg-[#fafafa]' : 'border-card-border bg-[#fafafa]/40'
                  }`}
                >
                  {/* Column header — subtle accent tint + top rule in the stage colour */}
                  <div
                    className="flex items-center justify-between px-3 py-2.5 border-b border-card-border rounded-t-xl border-t-2"
                    style={{ borderTopColor: accent, backgroundColor: `${accent}12` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                      <span className="text-xs font-semibold text-[#0a0a0a] truncate">{s.label}</span>
                    </div>
                    <span
                      className="text-[11px] font-medium tabular-nums shrink-0 px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${accent}20`, color: '#0a0a0a' }}
                    >
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">
                    {cards.length === 0 ? (
                      <div className={`text-[11px] text-muted/60 text-center py-6 rounded-lg border border-dashed ${isDropTarget ? 'border-[#0a0a0a]/30' : 'border-transparent'}`}>
                        {isDropTarget ? 'Drop here' : 'No leads'}
                      </div>
                    ) : (
                      cards.map((lead) => (
                        <div
                          key={lead._id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', lead._id)
                            e.dataTransfer.effectAllowed = 'move'
                            setDragId(lead._id)
                          }}
                          onDragEnd={() => { setDragId(null); setDragOverStage(null) }}
                          onClick={() => setSelectedLeadId(lead._id)}
                          className={`group rounded-lg border bg-white px-3 py-2.5 cursor-pointer transition-all-expo hover:border-[#d4d4d4] hover:shadow-sm ${
                            dragId === lead._id ? 'opacity-40' : ''
                          } ${savingId === lead._id ? 'ring-1 ring-[#0a0a0a]/20' : 'border-card-border'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-medium text-[#0a0a0a] truncate">{lead.name || 'Unnamed'}</p>
                            {isTestLead(lead) && (
                              <span className="text-[8px] font-medium px-1 py-0.5 rounded border border-muted text-muted shrink-0">Test</span>
                            )}
                          </div>
                          {lead.phone && (
                            <p className="text-[11px] text-muted font-mono mt-0.5 truncate">{lead.phone}</p>
                          )}
                          {lead.campaignName && (
                            <p className="text-[10px] text-muted/70 mt-1 truncate">{lead.campaignName}</p>
                          )}
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-muted/60 tabular-nums">
                              {getMetaCreated(lead) ? new Date(getMetaCreated(lead)).toLocaleDateString() : ''}
                            </span>
                            {typeof lead.dealValueEstimate === 'number' && (
                              <span className="text-[10px] font-medium text-[#0a0a0a] tabular-nums">
                                ₹{(lead.dealValueEstimate / 1e7).toFixed(2)}cr
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lead Drawer */}
      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onStageChange={load}
      />
    </div>
  )
}
