import { useState, useEffect, useMemo } from 'react'
import { getLeads } from '../api'
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

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
] as const

export default function Leads() {
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

  const loadLeads = () => {
    setLoading(true)
    setError(null)
    getLeads()
      .then((data) => setAllLeads(data.leads || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadLeads() }, [])

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

  const FilterSelect = ({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-2.5 text-sm border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Leads</h1>
          <p className="text-sm text-muted mt-0.5">{processed.real.length + processed.test.length} leads {hasFilters && '(filtered)'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={processed.real.length === 0 && processed.test.length === 0}
            className="px-3 py-1.5 text-xs font-medium border border-card-border rounded-md bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Presets */}
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setDatePreset(p.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              datePreset === p.value
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
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-9 px-2 text-sm border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a]"
            />
            <span className="text-xs text-muted">—</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-9 px-2 text-sm border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a]"
            />
          </div>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, or ID..."
            className="w-full h-9 pl-3 pr-3 text-sm border border-card-border rounded-md bg-white text-[#0a0a0a] placeholder-muted focus:outline-none focus:border-[#0a0a0a] transition-colors"
          />
        </div>
        <FilterSelect value={stageFilter} onChange={setStageFilter} options={filterOptions.stages} placeholder="All stages" />
        <FilterSelect value={campaignFilter} onChange={setCampaignFilter} options={filterOptions.campaigns} placeholder="All campaigns" />
        <FilterSelect value={formFilter} onChange={setFormFilter} options={filterOptions.forms} placeholder="All forms" />
        <FilterSelect value={sourceFilter} onChange={setSourceFilter} options={filterOptions.sources} placeholder="All sources" />
        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={showTestLeads}
            onChange={(e) => setShowTestLeads(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-card-border accent-[#0a0a0a]"
          />
          Show tests
        </label>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted hover:text-[#0a0a0a] transition-colors underline whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>
      )}

      {/* Table */}
      <div className="border border-card-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading leads...</div>
        ) : processed.real.length === 0 && processed.test.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {hasFilters ? 'No leads match your filters' : 'No leads yet. Go to Settings and sync Meta leads.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs border-b border-card-border bg-[#fafafa]">
                <th className="p-3 font-medium text-muted">Name</th>
                <th className="p-3 font-medium text-muted">Phone</th>
                <th className="p-3 font-medium text-muted">Campaign</th>
                <th className="p-3 font-medium text-muted">Stage</th>
                <th className="p-3 font-medium text-muted">Created</th>
              </tr>
            </thead>
            <tbody>
              {processed.real.map((lead: any) => (
                <tr
                  key={lead._id}
                  onClick={() => setSelectedLeadId(lead._id)}
                  className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  <td className="p-3 font-medium text-[#0a0a0a]">{lead.name || '—'}</td>
                  <td className="p-3 text-muted">{lead.phone || '—'}</td>
                  <td className="p-3 text-muted max-w-[150px] truncate">{lead.campaignName || '—'}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]" />
                      {lead.stage}
                    </span>
                  </td>
                  <td className="p-3 text-muted tabular-nums text-xs">
                    {getMetaCreated(lead) ? new Date(getMetaCreated(lead)).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}

              {/* Test leads separator */}
              {processed.test.length > 0 && (
                <>
                  <tr className="border-b border-card-border bg-[#fafafa]">
                    <td colSpan={5} className="p-2 text-[11px] text-muted font-medium pl-3">
                      Meta Test Leads ({processed.test.length})
                    </td>
                  </tr>
                  {processed.test.map((lead: any) => (
                    <tr
                      key={lead._id}
                      onClick={() => setSelectedLeadId(lead._id)}
                      className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors cursor-pointer opacity-60"
                    >
                      <td className="p-3 font-medium text-[#0a0a0a]">
                        <span className="inline-flex items-center gap-1.5">
                          {lead.name || '—'}
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-muted text-muted">Test</span>
                        </span>
                      </td>
                      <td className="p-3 text-muted">{lead.phone || '—'}</td>
                      <td className="p-3 text-muted max-w-[150px] truncate">{lead.campaignName || '—'}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#a0a0a0]" />
                          {lead.stage}
                        </span>
                      </td>
                      <td className="p-3 text-muted tabular-nums text-xs">
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