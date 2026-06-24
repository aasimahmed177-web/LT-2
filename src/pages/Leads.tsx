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

  useEffect(() => {
    loadLeads()
  }, [])

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

    // Separate test leads and sort: real leads first (newest Meta created), test leads at bottom
    const real = result.filter((l) => !isTestLead(l))
    const test = result.filter((l) => isTestLead(l))

    // Sort real leads by Meta created_time descending (newest first)
    real.sort((a, b) => {
      const da = getMetaCreated(a)
      const db = getMetaCreated(b)
      return db.localeCompare(da)
    })

    // Test leads sorted amongst themselves
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

  const stageBadge = (stage: string) => {
    const m: Record<string, string> = {
      Lead: 'bg-indigo-100 text-indigo-700',
      Contact: 'bg-amber-100 text-amber-700',
      Prospect: 'bg-blue-100 text-blue-700',
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
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-muted mt-0.5">{allLeads.length} leads</p>
        </div>
        <button
          onClick={loadLeads}
          className="px-4 py-1.5 text-sm text-muted border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, or lead ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm select-none">&#x1F50D;</span>
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-card-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading leads...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-500">Error: {error}</div>
        ) : processed.real.length === 0 && processed.test.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {searchQuery || stageFilter ? 'No leads match your search' : 'No leads yet. Go to Settings and sync Meta leads.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-gray-100 bg-gray-50/50">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Campaign</th>
                  <th className="p-3 font-medium">Stage</th>
                  <th className="p-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {processed.real.map((lead: any) => (
                  <tr
                    key={lead._id}
                    onClick={() => setSelectedLeadId(lead._id)}
                    className="border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-medium text-gray-800">{lead.name || '—'}</td>
                    <td className="p-3 text-gray-500">{lead.phone || '—'}</td>
                    <td className="p-3 text-gray-500 max-w-[200px] truncate">{lead.email || '—'}</td>
                    <td className="p-3 text-gray-500 max-w-[150px] truncate">{lead.campaignName || '—'}</td>
                    <td className="p-3">
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${stageBadge(lead.stage)}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500 tabular-nums text-xs">
                      {getMetaCreated(lead) ? new Date(getMetaCreated(lead)).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}

                {/* Test leads separator + rows */}
                {processed.test.length > 0 && (
                  <>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <td colSpan={6} className="p-2 text-[11px] text-muted font-medium pl-3">
                        Meta Test Leads ({processed.test.length})
                      </td>
                    </tr>
                    {processed.test.map((lead: any) => (
                      <tr
                        key={lead._id}
                        onClick={() => setSelectedLeadId(lead._id)}
                        className="border-b border-gray-50 hover:bg-gray-100/30 cursor-pointer transition-colors opacity-60"
                      >
                        <td className="p-3 font-medium text-gray-500">
                          {lead.name || '—'}
                          <span className="ml-1.5 text-[10px] font-medium px-1 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Test
                          </span>
                        </td>
                        <td className="p-3 text-gray-400">{lead.phone || '—'}</td>
                        <td className="p-3 text-gray-400 max-w-[200px] truncate">{lead.email || '—'}</td>
                        <td className="p-3 text-gray-400 max-w-[150px] truncate">{lead.campaignName || '—'}</td>
                        <td className="p-3">
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${stageBadge(lead.stage)}`}>
                            {lead.stage}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400 tabular-nums text-xs">
                          {getMetaCreated(lead) ? new Date(getMetaCreated(lead)).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
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