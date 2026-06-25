import { useState, useEffect } from 'react'
import { getHealth, importLeads, getSourceOfTruth, getLastImportResult, getClient, createClient, updateClientConfig, getClients as fetchClients } from '../api'
import { useClient } from '../ClientContext'

export default function Settings() {
  const { currentClientId, setCurrentClientId, currentClient } = useClient()
  const [health, setHealth] = useState<any>(null)
  const [source, setSource] = useState<any>(null)
  const [lastResult, setLastResult] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [clientConfig, setClientConfig] = useState<any>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [configLoading, setConfigLoading] = useState(true)

  // Client edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPageId, setEditPageId] = useState('')
  const [editPixelId, setEditPixelId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Add client state
  const [showAddClient, setShowAddClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPageId, setNewClientPageId] = useState('')
  const [newClientPixelId, setNewClientPixelId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    setHealthLoading(true)
    setConfigLoading(true)
    getHealth(currentClientId).then(setHealth).catch(() => setHealth({ status: 'error', metaConfigured: false, pageIdConfigured: false, pixelIdConfigured: false })).finally(() => setHealthLoading(false))
    getSourceOfTruth(currentClientId).then(setSource).catch(() => {})
    getLastImportResult(currentClientId).then(setLastResult).catch(() => {})
    getClient(currentClientId).then((c) => {
      setClientConfig(c)
      setEditName(c.name || '')
      setEditPageId(c.config?.pageId || '')
      setEditPixelId(c.config?.pixelId || '')
    }).catch(() => {}).finally(() => setConfigLoading(false))
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

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const payload: any = {}
      if (editName !== clientConfig?.name) payload.name = editName
      if (editPageId !== (clientConfig?.config?.pageId || '')) payload.pageId = editPageId
      if (editPixelId !== (clientConfig?.config?.pixelId || '')) payload.pixelId = editPixelId
      if (Object.keys(payload).length === 0) { setEditing(false); setSaving(false); return }
      await updateClientConfig(currentClientId, payload)
      // Refresh client config
      const fresh = await getClient(currentClientId)
      setClientConfig(fresh)
      setSaveSuccess(true)
      setEditing(false)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!newClientName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createClient(
        newClientName.trim(),
        newClientPageId.trim() || undefined,
        newClientPixelId.trim() || undefined,
      )
      // Refresh client list and switch to new client
      const data = await fetchClients()
      const newClient = data.clients.find((c: any) => c.id === created.id)
      if (newClient) {
        setCurrentClientId(newClient.id)
      }
      setShowAddClient(false)
      setNewClientName('')
      setNewClientPageId('')
      setNewClientPixelId('')
    } catch (e: any) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const ConfigRow = ({ label, ok, detail, warning }: { label: string; ok: boolean; detail?: string; warning?: string }) => (
    <div className="flex items-center gap-3 py-2">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : warning ? 'bg-amber-400' : 'bg-red-400'}`} />
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`text-xs ${ok ? 'text-emerald-600' : warning ? 'text-amber-600' : 'text-red-500'}`}>
        {ok ? 'Configured' : warning || 'Not configured'}
      </span>
      {detail && <span className="text-xs text-muted ml-1">{detail}</span>}
    </div>
  )

  const displayResult = result || lastResult

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-muted mt-0.5">Meta integration and data management</p>
        </div>
        <button
          onClick={() => setShowAddClient(!showAddClient)}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
        >
          {showAddClient ? 'Cancel' : '+ Add Client'}
        </button>
      </div>

      {/* Add Client Form */}
      {showAddClient && (
        <div className="bg-card rounded-xl border border-card-border p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">New Client</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Client Name *</label>
              <input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g. Acme Real Estate"
                className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-colors"
              />
              {newClientName.trim() && (
                <p className="text-[11px] text-muted mt-1">Slug: {newClientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Meta Page ID (optional)</label>
              <input
                value={newClientPageId}
                onChange={(e) => setNewClientPageId(e.target.value)}
                placeholder="e.g. 1135528059640106"
                className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Meta Pixel / Dataset ID (optional)</label>
              <input
                value={newClientPixelId}
                onChange={(e) => setNewClientPixelId(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-colors"
              />
            </div>
            {createError && (
              <p className="text-xs text-red-500">{createError}</p>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                disabled={creating || !newClientName.trim()}
                className="px-4 py-2 bg-[#0a0a0a] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating...' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meta Configuration */}
      <div className="bg-card rounded-xl border border-card-border p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Meta Configuration</h2>
        {healthLoading ? (
          <p className="text-sm text-muted">Checking configuration...</p>
        ) : health ? (
          <div>
            <div className="space-y-1">
              <ConfigRow label="Meta Page ID" ok={health.pageIdConfigured} />
              <ConfigRow label="Meta Access Token" ok={health.metaConfigured} />
              <ConfigRow label="Pixel / Dataset ID" ok={health.pixelIdConfigured} detail={health.pixelId} />
            </div>
            {!health.metaConfigured && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                <p className="font-medium">Meta integration is not fully configured</p>
                <p className="text-xs text-amber-700 mt-1">
                  {!health.pageIdConfigured && !health.metaConfigured ? 'META_PAGE_ID is missing. ' : ''}
                  {health.pageIdConfigured && !health.metaConfigured ? 'META_ACCESS_TOKEN is missing or invalid. ' : ''}
                  Add the required environment variables to .env.local and restart the server.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-500">Failed to check configuration</p>
        )}
      </div>

      {/* Client Configuration (editable) */}
      {configLoading ? (
        <div className="bg-card rounded-xl border border-card-border p-5">
          <p className="text-sm text-muted">Loading client configuration...</p>
        </div>
      ) : clientConfig && (
        <div className="bg-card rounded-xl border border-card-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Client Configuration</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-accent hover:text-indigo-600 transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Client Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Slug</label>
                <p className="text-sm text-gray-500 px-3 py-1.5 bg-gray-50 rounded-md">{clientConfig.id}</p>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Meta Page ID</label>
                <input
                  value={editPageId}
                  onChange={(e) => setEditPageId(e.target.value)}
                  placeholder="e.g. 1135528059640106"
                  className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Meta Pixel / Dataset ID</label>
                <input
                  value={editPixelId}
                  onChange={(e) => setEditPixelId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Token Status</label>
                <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
                  clientConfig.config?.tokenConfigured
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {clientConfig.config?.tokenConfigured ? 'Configured' : 'Not configured'}
                </span>
              </div>
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              {saveSuccess && <p className="text-xs text-emerald-600">Saved successfully</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => { setEditing(false); setSaveError(null) }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Name:</span>
                <span className="font-medium text-gray-800">{clientConfig.name || currentClient?.name || clientConfig.id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Slug:</span>
                <span className="font-mono text-xs text-gray-600">{clientConfig.id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Page ID:</span>
                <span className="font-mono text-xs">{clientConfig.config?.pageId || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Pixel/Dataset ID:</span>
                <span className="font-mono text-xs">{clientConfig.config?.pixelId || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Token:</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  clientConfig.config?.tokenConfigured
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {clientConfig.config?.tokenConfigured ? 'Configured' : 'Not configured'}
                </span>
              </div>
              {lastResult && lastResult.lastSyncedAt && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Last synced:</span>
                  <span className="text-xs text-gray-600">{new Date(lastResult.lastSyncedAt).toLocaleString()}</span>
                </div>
              )}
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
          )}
        </div>
      )}

      {/* Sync Leads */}
      <div className="bg-card rounded-xl border border-card-border p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Sync Meta Leads</h2>
        <p className="text-xs text-muted mb-4">Manually pull the latest leads from Meta. Dedup is automatic. CRM fields (stage, notes, tasks, history) are never overwritten.</p>
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
        >
          {importing ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Syncing...
            </>
          ) : 'Sync Meta Leads'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {displayResult && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Sync OK
              </span>
              {displayResult.lastSyncedAt && (
                <span className="text-xs text-muted">
                  {new Date(displayResult.lastSyncedAt).toLocaleString()}
                </span>
              )}
              {displayResult.errors?.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                  {displayResult.errors.length} error{displayResult.errors.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

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