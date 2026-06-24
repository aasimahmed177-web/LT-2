import { useState, useEffect, useMemo } from 'react'
import { getLeads } from '../api'
import LeadDrawer from '../LeadDrawer'

function getMetaCreated(lead: any): string {
  return lead?.fullResponse?.created_time || lead.ingestedAt || ''
}

function isTestLead(lead: any): boolean {
  return !!lead?.name?.includes('test lead: dummy data')
}

export default function Leads() {
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  const loadLeads = () => {
    setLoading(true)
    setError(null)
    getLeads()
      .then((data) => setAllLeads(data.leads || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadLeads() }, [])

  const processed = useMemo(() => {
    let result = allLeads

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

    if (stageFilter) {
      result = result.filter((l) => l.stage === stageFilter)
    }

    const real = result.filter((l) => !isTestLead(l))
    const test = result.filter((l) => isTestLead(l))

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
  }, [allLeads, searchQuery, stageFilter])

  const stages = useMemo(() => {
    const set = new Set(allLeads.map((l) => l.stage))
    return Array.from(set).sort()
  }, [allLeads])

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Leads</h1>
          <p className="text-sm text-muted mt-0.5">{allLeads.length} leads</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, or ID..."
            className="w-full h-9 pl-3 pr-3 text-sm border border-card-border rounded-md bg-white text-[#0a0a0a] placeholder-muted focus:outline-none focus:border-[#0a0a0a] transition-colors"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-9 px-3 text-sm border border-card-border rounded-md bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(searchQuery || stageFilter) && (
          <button
            onClick={() => { setSearchQuery(''); setStageFilter('') }}
            className="text-xs text-muted hover:text-[#0a0a0a] transition-colors"
          >
            Clear
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
            {searchQuery || stageFilter ? 'No leads match your search' : 'No leads yet. Go to Settings and sync Meta leads.'}
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