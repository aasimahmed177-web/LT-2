import { useState, useEffect } from 'react'
import { getHealth, importLeads } from '../api'

export default function Settings() {
  const [health, setHealth] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ status: 'error' }))
  }, [])

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const res = await importLeads()
      setResult(res)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <h1>Settings</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Meta Configuration</h2>
        {health ? (
          <div>
            <p>Status: <strong>{health.status}</strong></p>
            <p>Configured: <strong>{health.metaConfigured ? 'Yes' : 'No'}</strong></p>
            {health.pageId && <p>Page ID: {health.pageId}</p>}
            {!health.metaConfigured && (
              <p style={{ color: '#c00' }}>
                Set META_ACCESS_TOKEN and META_PAGE_ID in server/.env
              </p>
            )}
          </div>
        ) : (
          <p>Loading health...</p>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Sync Leads</h2>
        <button
          onClick={handleImport}
          disabled={importing}
          style={{
            padding: '8px 24px',
            fontSize: 16,
            cursor: importing ? 'not-allowed' : 'pointer',
          }}
        >
          {importing ? 'Syncing...' : 'Sync Meta Leads'}
        </button>

        {error && (
          <div style={{ marginTop: 16, padding: 12, background: '#fee', borderRadius: 4 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16, padding: 12, background: '#efe', borderRadius: 4 }}>
            <p><strong>Sync Result</strong></p>
            <p>Imported: {result.imported}</p>
            <p>Updated: {result.updated}</p>
            <p>Total in DB: {result.total}</p>
          </div>
        )}
      </section>
    </div>
  )
}