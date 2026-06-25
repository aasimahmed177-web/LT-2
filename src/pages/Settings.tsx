import { useState, useEffect } from 'react'
import { getHealth, importLeads, getSourceOfTruth, getLastImportResult, getClient } from '../api'
import { useClient } from '../ClientContext'

export default function Settings() {
  const { currentClientId } = useClient()
  const [health, setHealth] = useState<any>(null)
  const [source, setSource] = useState<any>(null)
  const [lastResult, setLastResult] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [clientConfig, setClientConfig] = useState<any>(null)

  useEffect(() => {
    getHealth(currentClientId).then(setHealth).catch(() => setHealth({ status: 'error' }))
    getSourceOfTruth(currentClientId).then(setSource).catch(() => {})
    getLastImportResult(currentClientId).then(setLastResult).catch(() => {})
    getClient(currentClientId).then(setClientConfig).catch(() => {})
  }, [currentClientId])

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const res = await importLeads(currentClientId)
      setResult(res)
      setLastResult({ ...res, lastSyncedAt: new Date().toISOString() })
      const fresh = await getSourceOfTruth(currentClientId)
      setSource(fresh)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  const ConfigRow = ({ label, ok }: { label: string; ok: boolean }) => (
    <div className="flex items-center gap-3 py-2">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-xs text-muted">{ok ? 'Configured' : 'Not configured'}</span>
    </div>
  )

  const displayResult = result || lastResult

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Meta integration and data management</p>
      </div>

      {/* Meta Configuration */}
      <div className="bg-card rounded-xl border border-card-border p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Meta Configuration</h2>
        {health ? (
          <div className="space-y-1">
            <ConfigRow label="Meta Page ID" ok={!!health.pageId} />
            <ConfigRow label="Meta Access Token" ok={health.metaConfigured} />
            {health.pageId && (
              <p className="text-xs text-muted mt-2">Page ID: {health.pageId}...</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Loading health check...</p>
        )}
      </div>

      {/* Client Configuration */}
      {clientConfig && (
        <div className="bg-card rounded-xl border border-card-border p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Client Configuration</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Page ID:</span>
              <span className="font-mono text-xs">{clientConfig.config?.pageId || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Token configured:</span>
              <span className={`text-xs font-medium ${clientConfig.config?.tokenConfigured ? 'text-emerald-600' : 'text-red-500'}`}>
                {clientConfig.config?.tokenConfigured ? 'Yes' : 'No'}
              </span>
            </div>
            {clientConfig.forms && clientConfig.forms.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted mb-1.5">Imported Forms ({clientConfig.forms.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {clientConfig.forms.map((f: any) => (
                    <span key={f.formId} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {f.formName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Leads */}
      <div className="bg-card rounded-xl border border-card-border p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Sync Meta Leads</h2>
        <p className="text-xs text-muted mb-4">Manually pull the latest leads from Meta. Dedup is automatic. CRM fields (stage, notes, tasks, history) are never overwritten.</p>
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? 'Syncing...' : 'Sync Meta Leads'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {displayResult && (
          <div className="mt-4 space-y-3">
            {displayResult.lastSyncedAt && (
              <p className="text-xs text-muted">
                Last synced: {new Date(displayResult.lastSyncedAt).toLocaleString()}
              </p>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Forms Scanned', value: displayResult.formsScanned },
                { label: 'Leads Created', value: displayResult.created },
                { label: 'Leads Updated', value: displayResult.updated },
                { label: 'Skipped', value: displayResult.skipped },
                { label: 'Total Fetched', value: displayResult.leadsFetched },
                { label: 'Total in DB', value: displayResult.total },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-muted">{s.label}</p>
                  <p className="text-lg font-bold text-gray-800 tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>

            {(displayResult.errors && displayResult.errors.length > 0) && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs font-medium text-red-700 mb-1">Errors</p>
                {displayResult.errors.map((e: any, i: number) => (
                  <p key={i} className="text-xs text-red-600">{e.formName}: {e.error}</p>
                ))}
              </div>
            )}

            {displayResult.forms && displayResult.forms.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted mb-2">Per-form breakdown:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted border-b border-gray-100">
                        <th className="pb-1.5 pr-3 font-medium">Form</th>
                        <th className="pb-1.5 pr-3 font-medium">Status</th>
                        <th className="pb-1.5 pr-3 font-medium">Leads</th>
                        <th className="pb-1.5 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayResult.forms.map((f: any) => (
                        <tr key={f.formId} className="border-b border-gray-50">
                          <td className="py-1.5 pr-3 text-gray-700 max-w-[200px] truncate" title={f.formName}>
                            {f.formName}
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                              f.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums">{f.leadsFetched}</td>
                          <td className="py-1.5 text-red-500">{f.error || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {!displayResult && !error && !importing && (
          <p className="text-xs text-muted mt-4">No sync has been run yet. Press the button above to fetch leads from Meta.</p>
        )}
      </div>

      {/* Source of Truth */}
      <div className="bg-card rounded-xl border border-card-border p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Data Source</h2>
        {source && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-medium text-gray-700">Convex Cloud</span>
              <span className="text-muted">— {source.totalLeads} total leads</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="font-medium text-gray-700">Meta Leads</span>
              <span className="text-muted">— {source.totalLeads} (100%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="font-medium text-gray-700">Demo Leads</span>
              <span className="text-muted">— 0</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Object.entries(source.byStage || {}).map(([stage, count]) => (
                <span key={stage} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {stage}: {count as number}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}