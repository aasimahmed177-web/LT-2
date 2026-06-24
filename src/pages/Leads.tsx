import { useState, useEffect } from 'react'
import { getLeads } from '../api'

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLeads()
      .then((data) => setLeads(data.leads))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading leads...</div>
  if (error) return <div style={{ color: '#c00' }}>Error: {error}</div>

  return (
    <div>
      <h1>Leads</h1>
      {leads.length === 0 ? (
        <p>No leads yet. Go to Settings and sync Meta leads.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Email</th>
              <th style={{ padding: 8 }}>Phone</th>
              <th style={{ padding: 8 }}>Campaign</th>
              <th style={{ padding: 8 }}>Stage</th>
              <th style={{ padding: 8 }}>Imported</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead: any) => (
              <tr key={lead._id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{lead.name || '-'}</td>
                <td style={{ padding: 8 }}>{lead.email || '-'}</td>
                <td style={{ padding: 8 }}>{lead.phone || '-'}</td>
                <td style={{ padding: 8 }}>{lead.campaignName || '-'}</td>
                <td style={{ padding: 8 }}>{lead.stage}</td>
                <td style={{ padding: 8 }}>{lead.ingestedAt ? new Date(lead.ingestedAt).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}