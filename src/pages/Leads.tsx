import { useState, useEffect, useMemo } from 'react'
import { getLeads, getLeadsEnriched } from '../api'
import { useClient } from '../ClientContext'
import LeadDrawer from '../LeadDrawer'

function getMetaCreated(lead: any): string {
  return lead?.fullResponse?.created_time || lead.ingestedAt || ''
}

function isTestLead(lead: any): boolean {
  return !!lead?.name?.includes('test lead: dummy data')
}

function getDateRange(preset: string, customStart: string, customEnd: string): { start: Date; end: Date } | null {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (preset === 'all') return null
  if (preset === 'custom') {
    if (!customStart || !customEnd) return null
    return { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59.999') }
  }
  const days = preset === 'today' ? 0 : preset === 'yesterday' ? 1 : preset === '7d' ? 7 : preset === '14d' ? 14 : preset === '30d' ? 30 : null
  if (days === null) return null
  if (days === 0) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { start, end }
  }
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return { start, end }
}

function isInRange(createdTime: string, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true
  if (!createdTime) return false
  const d = new Date(createdTime)
  return d >= range.start && d <= range.end
}

function escapeCsv(val: any): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function downloadCsv(rows: any[], filename: string) {
  const header = 'name,phone,email,budget,purpose,stage,source,formName,campaignName,adName,adSetName,metaLeadId,metaCreatedTime,importedAt,lastStageChangedAt'
  const lines = rows.map((l) => {
    const fieldData = l.fieldData || []
    const budget = fieldData.find((f: any) => (f.name || '').toLowerCase().includes('budget'))?.values?.[0] || ''
    const purpose = fieldData.find((f: any) => (f.name || '').toLowerCase().includes('purpose') || (f.name || '').toLowerCase().includes('why'))?.values?.[0] || ''
    return [
      escapeCsv(l.name),
      escapeCsv(l.phone),
      escapeCsv(l.email),
      escapeCsv(budget),
      escapeCsv(purpose),
      escapeCsv(l.stage),
      escapeCsv(l.platform || 'meta'),
      escapeCsv(l.formName),
      escapeCsv(l.campaignName),
      escapeCsv(l.adName),
      escapeCsv(l.adSetName),
      escapeCsv(l.metaLeadId),
      escapeCsv(getMetaCreated(l)),
      escapeCsv(l.ingestedAt),
      escapeCsv(l.stageChangedAt),
    ].join(',')
  }).join('\n')
  const blob = new Blob([header + '\n' + lines], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadReconciliationCsv(leads: any[], filename: string) {
  const header = [
    'CRM Lead ID',
    'Meta Lead ID',
    'Lead Name',
    'Phone',
    'Email',
    'Current CRM Stage',
    'Form Name',
    'Campaign Name',
    'Adset Name',
    'Ad Name',
    'Created Time',
    'Last Updated Time',
    'Notes count',
    'Latest note/comment',
  ].join(',')

  const lines = leads.map((l) => {
    const notes = l.notes || []
    const latestNote = notes.length > 0 ? notes[notes.length - 1].content : ''
    const lastUpdated = l.stageChangedAt || l.ingestedAt || ''
    return [
      escapeCsv(l._id),
      escapeCsv(l.metaLeadId),
      escapeCsv(l.name),
      escapeCsv(l.phone),
      escapeCsv(l.email),
      escapeCsv(l.stage),
      escapeCsv(l.formName),
      escapeCsv(l.campaignName),
      escapeCsv(l.adSetName),
      escapeCsv(l.adName),
      escapeCsv(getMetaCreated(l)),
      escapeCsv(lastUpdated),
      escapeCsv(notes.length),
      escapeCsv(latestNote),
    ].join(',')
  }).join('\n')

  const blob = new Blob([header + '\n' + lines], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
] as const

export default function Leads() {
  const { currentClientId } = useClient()
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  // New filters
  const [datePreset, setDatePreset] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [formFilter, setFormFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [showTestLeads, setShowTestLeads] = useState(false)
  const [exportingRecon, setExportingRecon] = useState(false)
  const [showMappingGuide, setShowMappingGuide] = useState(false)
  const [copiedMetaId, setCopiedMetaId] = useState<string | null>(null)

  const POSITIVE_STAGES = new Set(['Contact', 'Prospect', 'ConversionLead', 'Purchase'])
  const NEGATIVE_STAGES = new Set(['NotQualified', 'NoResponse', 'Invalid', 'Duplicate'])
  const stageClass = (s: string) => POSITIVE_STAGES.has(s) ? 'stage-positive' : NEGATIVE_STAGES.has(s) ? 'stage-negative' : 'stage-neutral'

  const loadLeads = () => {
    setLoading(true)
    setError(null)
    getLeads(currentClientId)
      .then((data) => setAllLeads(data.leads || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

useEffect(() => {
    loadLeads()
  }, [currentClientId])

  // Filter options
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

  const dateRange = useMemo(() => getDateRange(datePreset, customStart, customEnd), [datePreset, customStart, customEnd])

  const hasFilters = datePreset !== 'all' || stageFilter || campaignFilter || formFilter || sourceFilter || showTestLeads || searchQuery.trim()

  const clearFilters = () => {
    setDatePreset('all')
    setCustomStart('')
    setCustomEnd('')
    setStageFilter('')
    setCampaignFilter('')
    setFormFilter('')
    setSourceFilter('')
    setShowTestLeads(false)
    setSearchQuery('')
  }

  const processed = useMemo(() => {
    let result = allLeads

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.phone && l.phone.toLowerCase().includes(q)) ||
          (l.metaLeadId && l.metaLeadId.toLowerCase().includes(q))
      )
    }

    // Stage filter
    if (stageFilter) {
      result = result.filter((l) => l.stage === stageFilter)
    }

    // Date filter
    if (datePreset !== 'all') {
      result = result.filter((l) => isInRange(getMetaCreated(l), dateRange))
    }

    // Campaign filter
    if (campaignFilter) {
      result = result.filter((l) => l.campaignName === campaignFilter)
    }

    // Form filter
    if (formFilter) {
      result = result.filter((l) => l.formName === formFilter)
    }

    // Source filter
    if (sourceFilter) {
      result = result.filter((l) => l.platform === sourceFilter)
    }

    // Test lead toggle
    const real = result.filter((l) => !isTestLead(l))
    const test = result.filter((l) => isTestLead(l))

    if (!showTestLeads) {
      return { real, test: [] }
    }

    real.sort((a, b) => {
      const da = getMetaCreated(a)
      const db = getMetaCreated(b)
      return db.localeCompare(da)
    })

    test.sort((a, b) => {
      const da = getMetaCreated(a)
      const db = getMetaCreated(b)
      return db.localeCompare(da)
    })

    return { real, test }
  }, [allLeads, searchQuery, stageFilter, datePreset, dateRange, campaignFilter, formFilter, sourceFilter, showTestLeads])

  const handleExport = () => {
    const allFiltered = [...processed.real, ...(showTestLeads ? processed.test : [])]
    downloadCsv(allFiltered, `leads-export-${new Date().toISOString().substring(0, 10)}.csv`)
  }

  const handleReconciliationExport = async () => {
    setExportingRecon(true)
    try {
      const data = await getLeadsEnriched(currentClientId)
      const enrichedLeads = (data.leads || []).filter((l: any) => !isTestLead(l))
      downloadReconciliationCsv(enrichedLeads, `crm-reconciliation-${new Date().toISOString().substring(0, 10)}.csv`)
    } catch (e: any) {
      console.error('Reconciliation export error:', e)
    } finally {
      setExportingRecon(false)
    }
  }

  const FilterSelect = ({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2.5 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Leads</h1>
          <p className="text-sm text-muted mt-0.5">
            {processed.real.length + processed.test.length} lead{(processed.real.length + processed.test.length) !== 1 ? 's' : ''}
            {hasFilters && ' (filtered)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={processed.real.length === 0 && processed.test.length === 0}
            className="h-8 px-3 text-xs font-medium border border-card-border rounded-md bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] disabled:opacity-40 disabled:cursor-not-allowed transition-all-expo"
          >
            Export CSV
          </button>
          <button
            onClick={handleReconciliationExport}
            disabled={exportingRecon}
            className="h-8 px-3 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {exportingRecon ? 'Exporting...' : 'CRM Reconciliation'}
          </button>
        </div>
      </div>

{/* CRM Reconciliation Helper Section */}
      <div className="border border-card-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowMappingGuide(!showMappingGuide)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium text-muted hover:text-[#0a0a0a] transition-all-expo bg-white"
        >
          <span>CRM Stage Mapping Guide</span>
          <span className={`transform transition-transform duration-150 ${showMappingGuide ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        {showMappingGuide && (
          <div className="px-5 pb-4 pt-1 border-t border-card-border bg-[#fafafa]">
            <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Recommended manual mapping from calling team sheet to CRM stages</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-1.5 pr-4 text-muted font-medium">Calling Team Status</th>
                  <th className="text-left py-1.5 text-muted font-medium">CRM Stage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Contacted — blank (not yet reached)', 'Lead'],
                  ['Contacted — No', 'NoResponse'],
                  ['Contacted — Yes', 'Contact'],
                  ['Interested — Yes', 'Prospect'],
                  ['Meeting Scheduled — Yes', 'ConversionLead'],
                  ['Paid / Closed', 'Purchase'],
                  ['Not interested', 'NotQualified'],
                  ['Invalid / wrong number', 'Invalid'],
                  ['Duplicate', 'Duplicate'],
                ].map(([fromTeam, toCrm]) => (
                  <tr key={fromTeam} className="border-b border-card-border/50 last:border-0">
                    <td className="py-1.5 pr-4 text-[#0a0a0a]">{fromTeam}</td>
                    <td className="py-1.5">
                      <span className={stageClass(toCrm)}>
                      <span className={`w-1.5 h-1.5 rounded-full ${POSITIVE_STAGES.has(toCrm) ? 'bg-white' : NEGATIVE_STAGES.has(toCrm) ? 'bg-[#d4d4d4]' : 'bg-[#0a0a0a]'}`} />
                      {toCrm}
                    </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Date Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setDatePreset(p.value)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all-expo ${
              datePreset === p.value
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
          <div className="flex items-center gap-1.5">
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

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative flex-1 max-w-xs">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, or Meta Lead ID..."
            className="w-full h-8 pl-3 pr-3 text-xs border border-card-border rounded-md bg-white text-[#0a0a0a] placeholder-muted/60 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
          />
        </div>
        <FilterSelect value={stageFilter} onChange={setStageFilter} options={filterOptions.stages} placeholder="All stages" />
        <FilterSelect value={campaignFilter} onChange={setCampaignFilter} options={filterOptions.campaigns} placeholder="All campaigns" />
        <FilterSelect value={formFilter} onChange={setFormFilter} options={filterOptions.forms} placeholder="All forms" />
        <FilterSelect value={sourceFilter} onChange={setSourceFilter} options={filterOptions.sources} placeholder="All sources" />
        <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer select-none whitespace-nowrap">
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
            className="text-[11px] text-muted hover:text-[#0a0a0a] transition-all-expo underline whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>
      )}

      {/* Table */}
      <div className="border border-card-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading leads...</div>
        ) : processed.real.length === 0 && processed.test.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted">
              {hasFilters ? 'No leads match your filters' : 'No leads yet. Go to Settings and sync Meta leads.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-card-border bg-[#fafafa] table-sticky-header">
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Name</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Phone</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Campaign</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Stage</th>
                <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Meta ID</th>
                <th className="py-2.5 pr-4 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Created</th>
              </tr>
            </thead>
            <tbody>
              {processed.real.map((lead: any) => (
                <tr
                  key={lead._id}
                  onClick={() => setSelectedLeadId(lead._id)}
                  className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-all-expo cursor-pointer"
                >
                  <td className="px-4 py-3 pr-4 font-medium text-[#0a0a0a] text-sm">{lead.name || '—'}</td>
                  <td className="py-3 pr-4 text-muted text-xs font-mono">{lead.phone || '—'}</td>
                  <td className="py-3 pr-4 text-muted text-xs max-w-[160px] truncate">{lead.campaignName || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={stageClass(lead.stage)}>
                      <span className={`w-1.5 h-1.5 rounded-full ${POSITIVE_STAGES.has(lead.stage) ? 'bg-white' : NEGATIVE_STAGES.has(lead.stage) ? 'bg-[#d4d4d4]' : 'bg-[#0a0a0a]'}`} />
                      {lead.stage}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {lead.metaLeadId ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(lead.metaLeadId).then(() => {
                            setCopiedMetaId(lead._id)
                            setTimeout(() => setCopiedMetaId(null), 1500)
                          })
                        }}
                        className="font-mono text-[11px] text-muted hover:text-[#0a0a0a] transition-colors truncate max-w-[110px] block text-left"
                        title={lead.metaLeadId}
                      >
                        {copiedMetaId === lead._id ? 'Copied!' : lead.metaLeadId.slice(0, 10) + '…'}
                      </button>
                    ) : <span className="text-muted text-[11px]">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-muted tabular-nums text-xs">
                    {getMetaCreated(lead) ? new Date(getMetaCreated(lead)).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}

              {/* Test leads separator */}
              {processed.test.length > 0 && (
                <>
                  <tr className="border-b border-card-border bg-[#f5f5f5]">
                    <td colSpan={6} className="px-4 py-2 text-[10px] text-muted font-medium uppercase tracking-wider">
                      Meta Test Leads ({processed.test.length})
                    </td>
                  </tr>
                  {processed.test.map((lead: any) => (
                    <tr
                      key={lead._id}
                      onClick={() => setSelectedLeadId(lead._id)}
                      className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-all-expo cursor-pointer opacity-50"
                    >
                      <td className="px-4 py-3 pr-4 font-medium text-[#0a0a0a] text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          {lead.name || '—'}
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-muted text-muted">Test</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted text-xs font-mono">{lead.phone || '—'}</td>
                      <td className="py-3 pr-4 text-muted text-xs max-w-[160px] truncate">{lead.campaignName || '—'}</td>
                      <td className="py-3 pr-4">
                        <span className={stageClass(lead.stage)}>
                          <span className={`w-1.5 h-1.5 rounded-full ${POSITIVE_STAGES.has(lead.stage) ? 'bg-white' : NEGATIVE_STAGES.has(lead.stage) ? 'bg-[#d4d4d4]' : 'bg-[#0a0a0a]'}`} />
                          {lead.stage}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {lead.metaLeadId ? (
                          <span className="font-mono text-[11px] text-muted truncate max-w-[110px] block" title={lead.metaLeadId}>
                            {lead.metaLeadId.slice(0, 10)}…
                          </span>
                        ) : <span className="text-muted text-[11px]">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-muted tabular-nums text-xs">
                        {getMetaCreated(lead) ? new Date(getMetaCreated(lead)).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Lead Drawer */}
      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onStageChange={loadLeads}
      />
    </div>
  )
}