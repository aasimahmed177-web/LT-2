import { useState, useEffect } from 'react'
import { getHealth, importLeads, getSourceOfTruth, getLastImportResult, getClient, createClient, updateClientConfig, getClients as fetchClients, getCapiStatus, getEventsCounts, getSystemHealth } from '../api'
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
  const [capiStatus, setCapiStatus] = useState<any>(null)
  const [capiStatusLoading, setCapiStatusLoading] = useState(true)
  const [eventCounts, setEventCounts] = useState<any>(null)
  const [systemHealth, setSystemHealth] = useState<any>(null)
  const [systemHealthLoading, setSystemHealthLoading] = useState(true)

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
    setCapiStatusLoading(true)
    getHealth(currentClientId).then(setHealth).catch(() => setHealth({ status: 'error', metaConfigured: false, pageIdConfigured: false, pixelIdConfigured: false })).finally(() => setHealthLoading(false))
    getSourceOfTruth(currentClientId).then(setSource).catch(() => {})
    getLastImportResult(currentClientId).then(setLastResult).catch(() => {})
    getClient(currentClientId).then((c) => {
      setClientConfig(c)
      setEditName(c.name || '')
      setEditPageId(c.config?.pageId || '')
      setEditPixelId(c.config?.pixelId || '')
    }).catch(() => {}).finally(() => setConfigLoading(false))
    getCapiStatus().then(setCapiStatus).catch(() => {}).finally(() => setCapiStatusLoading(false))
    getEventsCounts(currentClientId).then(setEventCounts).catch(() => {})
    getSystemHealth(currentClientId).then(setSystemHealth).catch(() => {}).finally(() => setSystemHealthLoading(false))
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
    <div className="flex items-center gap-3 py-1.5">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : warning ? 'bg-amber-400' : 'bg-red-400'}`} />
      <span className="text-sm text-[#0a0a0a]">{label}</span>
      <span className={`text-xs font-medium ${ok ? 'text-emerald-600' : warning ? 'text-amber-600' : 'text-red-500'}`}>
        {ok ? 'Configured' : warning || 'Not configured'}
      </span>
      {detail && <span className="text-xs text-muted ml-1 font-mono">{detail}</span>}
    </div>
  )

  const displayResult = result || lastResult

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Settings</h1>
          <p className="text-sm text-muted mt-0.5">Meta integration and data management</p>
        </div>
        <button
          onClick={() => setShowAddClient(!showAddClient)}
          className="h-8 px-3 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 transition-all-expo"
        >
          {showAddClient ? 'Cancel' : '+ Add Client'}
        </button>
      </div>

      {/* CAPI Warning Banners */}
      {systemHealth?.capi?.liveSendingEnabled && (
        <div className="warning-banner border border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Live CAPI mode is ON</p>
          <p className="text-xs text-amber-700 mt-1">Positive final-stage changes (Contact, Prospect, ConversionLead, Purchase) can send events to Meta.</p>
          <p className="text-xs text-amber-600 mt-0.5">Set <code className="text-amber-800 font-mono text-[11px] bg-amber-100 px-1 rounded">META_CAPI_DRY_RUN=true</code> to disable live sending.</p>
        </div>
      )}
      {systemHealth?.capi?.dryRun && (
        <div className="warning-banner border border-blue-200 bg-blue-50">
          <p className="text-sm font-semibold text-blue-800">Dry-run mode is ON</p>
          <p className="text-xs text-blue-700 mt-1">Events will be recorded but not sent to Meta.</p>
          <p className="text-xs text-blue-600 mt-0.5">Set <code className="text-blue-800 font-mono text-[11px] bg-blue-100 px-1 rounded">META_CAPI_DRY_RUN=false</code> to enable live sending.</p>
        </div>
      )}

      {/* System Health */}
      <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-4">System Health</h2>
        {systemHealthLoading ? (
          <p className="text-sm text-muted">Loading system health...</p>
        ) : systemHealth ? (
          <div className="space-y-4">
            {/* Environment Status */}
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1.5">Environment</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <ConfigRow label="Convex URL" ok={systemHealth.convex?.configured} />
                <ConfigRow label="Meta Page ID" ok={systemHealth.meta?.pageIdConfigured} detail={systemHealth.meta?.pageId} />
                <ConfigRow label="Meta Pixel / Dataset ID" ok={systemHealth.meta?.pixelIdConfigured} detail={systemHealth.meta?.pixelId} />
                <ConfigRow label="Meta Access Token" ok={systemHealth.meta?.accessTokenConfigured} detail={systemHealth.meta?.accessTokenPreview || ''} />
                <ConfigRow label="Test Event Code" ok={systemHealth.meta?.testEventCodeConfigured} />
              </div>
            </div>

            {/* CAPI Mode */}
            <div className="pt-2 border-t border-card-border/50">
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1.5">CAPI Mode</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <ConfigRow label="Dry-run mode" ok={systemHealth.capi?.dryRun} warning={!systemHealth.capi?.dryRun ? 'OFF' : undefined} />
                <ConfigRow label="Live sending" ok={systemHealth.capi?.liveSendingEnabled} warning={!systemHealth.capi?.liveSendingEnabled ? 'Disabled' : undefined} />
              </div>
            </div>

            {/* Client */}
            <div className="pt-2 border-t border-card-border/50">
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1.5">Client</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <ConfigRow label="Client name" ok={!!systemHealth.client?.name} detail={systemHealth.client?.name || ''} />
                <ConfigRow label="Total real leads" ok={systemHealth.leads?.totalReal > 0} detail={String(systemHealth.leads?.totalReal || 0)} />
              </div>
            </div>

            {/* Event Counts */}
            {systemHealth.events && (
              <div className="pt-2 border-t border-card-border/50">
                <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Event counts</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Sent', value: systemHealth.events.sent, color: 'text-emerald-600' },
                    { label: 'Pending', value: systemHealth.events.pending, color: 'text-gray-500' },
                    { label: 'Failed', value: systemHealth.events.failed, color: 'text-red-500' },
                    { label: 'Suppressed', value: systemHealth.events.suppressed, color: 'text-amber-600' },
                    { label: 'Skipped', value: systemHealth.events.skipped, color: 'text-gray-400' },
                    { label: 'Cancelled', value: systemHealth.events.cancelled, color: 'text-gray-400' },
                    { label: 'Dry-run', value: systemHealth.events.dryRun, color: 'text-gray-400' },
                    { label: 'Total', value: systemHealth.events.total, color: 'text-[#0a0a0a]' },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 border border-card-border rounded-lg p-2.5 text-center transition-all-expo hover:border-[#d4d4d4]">
                      <p className="text-[10px] text-muted uppercase tracking-wider">{s.label}</p>
                      <p className={`text-base font-bold tabular-nums mt-0.5 ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last event timestamps */}
            <div className="pt-2 border-t border-card-border/50 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-0.5">Last sent event</p>
                {systemHealth.lastSentEvent ? (
                  <p className="text-xs text-[#0a0a0a]">
                    {systemHealth.lastSentEvent.eventName} — {new Date(systemHealth.lastSentEvent.time).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-muted">None</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-0.5">Last failed event</p>
                {systemHealth.lastFailedEvent ? (
                  <div>
                    <p className="text-xs text-red-600">{systemHealth.lastFailedEvent.eventName} — {new Date(systemHealth.lastFailedEvent.time).toLocaleString()}</p>
                    <p className="text-xs text-muted mt-0.5 truncate" title={systemHealth.lastFailedEvent.error}>{systemHealth.lastFailedEvent.error}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted">None</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-500">Failed to load system health</p>
        )}
      </div>

      {/* CAPI Safety Explanation Card */}
      <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-3">CAPI Safety Overview</h2>
        <div className="space-y-3 text-xs">
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1.5">Stages that send events</p>
            <div className="flex flex-wrap gap-1.5">
              {['Contact', 'Prospect', 'ConversionLead', 'Purchase'].map((s) => (
                <span key={s} className="stage-pill bg-emerald-50 border-emerald-200 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {s}
                </span>
              ))}
            </div>
            <p className="text-muted mt-1">These positive stages trigger CAPI events (Contact→Contact, Prospect→QualifiedLead, ConversionLead→Lead, Purchase→Purchase).</p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1.5">Stages that never send</p>
            <div className="flex flex-wrap gap-1.5">
              {['Lead', 'NoResponse', 'NotQualified', 'Invalid', 'Duplicate'].map((s) => (
                <span key={s} className="stage-pill bg-gray-50 border-card-border text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#a0a0a0]" />
                  {s}
                </span>
              ))}
            </div>
            <p className="text-muted mt-1">No CAPI events are created for these stages.</p>
          </div>
          <div className="pt-2 border-t border-card-border/50 space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold mt-0.5">✓</span>
              <span className="text-muted"><strong className="text-[#0a0a0a]">Final-stage-only suppression</strong> is active. When a higher-stage event (e.g. Purchase) has been sent, lower-stage events are automatically suppressed.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold mt-0.5">✓</span>
              <span className="text-muted"><strong className="text-[#0a0a0a]">CSV cleanup</strong> does not send CAPI events.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Client Form */}
      {showAddClient && (
        <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-4">New Client</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted block mb-1 uppercase tracking-wider">Client Name *</label>
              <input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g. Acme Real Estate"
                className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
              />
              {newClientName.trim() && (
                <p className="text-[11px] text-muted mt-1">Slug: {newClientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'}</p>
              )}
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1 uppercase tracking-wider">Meta Page ID (optional)</label>
              <input
                value={newClientPageId}
                onChange={(e) => setNewClientPageId(e.target.value)}
                placeholder="e.g. 1135528059640106"
                className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1 uppercase tracking-wider">Meta Pixel / Dataset ID (optional)</label>
              <input
                value={newClientPixelId}
                onChange={(e) => setNewClientPixelId(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
              />
            </div>
            {createError && (
              <p className="text-xs text-red-500">{createError}</p>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                disabled={creating || !newClientName.trim()}
                className="h-8 px-4 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 disabled:opacity-50 transition-all-expo"
              >
                {creating ? 'Creating...' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meta Configuration */}
      <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-3">Meta Configuration</h2>
        {healthLoading ? (
          <p className="text-sm text-muted">Checking configuration...</p>
        ) : health ? (
          <div>
            <div className="space-y-0.5">
              <ConfigRow label="Meta Page ID" ok={health.pageIdConfigured} detail={health.pageId} />
              <ConfigRow label="Meta Access Token" ok={health.tokenConfigured} />
              <ConfigRow label="Pixel / Dataset ID" ok={health.pixelIdConfigured} detail={health.pixelId} />
            </div>
            {!health.metaConfigured && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs font-medium text-amber-800">Meta integration is not fully configured</p>
                <p className="text-[11px] text-amber-700 mt-1">
                  {!health.pageIdConfigured ? 'META_PAGE_ID is missing. ' : ''}
                  {health.pageIdConfigured && !health.tokenConfigured ? 'META_ACCESS_TOKEN is missing or invalid. ' : ''}
                  Add the required environment variables to .env.local and restart the server.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-500">Failed to check configuration</p>
        )}
      </div>

      {/* CAPI Configuration */}
      <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-3">CAPI Configuration</h2>
        {capiStatusLoading ? (
          <p className="text-sm text-muted">Loading CAPI configuration...</p>
        ) : capiStatus ? (
          <div>
            <div className="space-y-0.5">
              <ConfigRow label="Pixel / Dataset ID" ok={capiStatus.pixelIdConfigured} detail={capiStatus.pixelId} />
              <ConfigRow label="Access Token" ok={capiStatus.tokenConfigured} />
              <ConfigRow label="CAPI Mode" ok={!capiStatus.dryRun} warning={capiStatus.dryRun ? 'Dry-run' : undefined} />
              <ConfigRow label="Test Event Code" ok={capiStatus.testEventCodeConfigured} />
            </div>
            {capiStatus.dryRun && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs font-medium text-amber-800">CAPI is in dry-run mode</p>
                <p className="text-[11px] text-amber-700 mt-1">
                  Events are recorded but not sent to Meta. Set META_CAPI_DRY_RUN=false to enable live sending.
                </p>
              </div>
            )}
            {!capiStatus.tokenConfigured && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs font-medium text-amber-800">CAPI not fully configured</p>
                <p className="text-[11px] text-amber-700 mt-1">
                  {!capiStatus.pixelIdConfigured ? 'META_PIXEL_ID is missing. ' : ''}
                  {capiStatus.pixelIdConfigured && !capiStatus.tokenConfigured ? 'META_ACCESS_TOKEN is missing. ' : ''}
                  Add the required environment variables to .env.local and restart the server.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-500">Failed to check CAPI configuration</p>
        )}
      </div>

      {/* CAPI Safety Status */}
      <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-3">CAPI Safety Status</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3 py-1.5">
            <span className={`w-2 h-2 rounded-full ${capiStatus?.dryRun ? 'bg-amber-400' : 'bg-emerald-500'}`} />
            <span className="text-sm text-[#0a0a0a]">Dry-run mode</span>
            <span className={`text-xs font-medium ${capiStatus?.dryRun ? 'text-amber-600' : 'text-emerald-600'}`}>
              {capiStatus?.dryRun ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center gap-3 py-1.5">
            <span className={`w-2 h-2 rounded-full ${capiStatus?.dryRun ? 'bg-amber-400' : 'bg-red-400'}`} />
            <span className="text-sm text-[#0a0a0a]">Live sending</span>
            <span className={`text-xs font-medium ${capiStatus?.dryRun ? 'text-amber-600' : 'text-red-500'}`}>
              {capiStatus?.dryRun ? 'Disabled' : 'Enabled'}
            </span>
          </div>
          <div className="pt-2 mt-2 border-t border-card-border/50">
            <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Event counts</p>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Pending', value: eventCounts?.pending || 0, color: 'text-gray-500' },
                { label: 'Sent', value: eventCounts?.sent || 0, color: 'text-emerald-600' },
                { label: 'Failed', value: eventCounts?.failed || 0, color: 'text-red-500' },
                { label: 'Cancelled', value: eventCounts?.cancelled || 0, color: 'text-gray-400' },
                { label: 'Skipped', value: eventCounts?.skipped || 0, color: 'text-gray-400' },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 border border-card-border rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider">{s.label}</p>
                  <p className={`text-lg font-bold tabular-nums mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Client Configuration (editable) */}
      {configLoading ? (
        <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
          <p className="text-sm text-muted">Loading client configuration...</p>
        </div>
      ) : clientConfig && (
        <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a]">Client Configuration</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] font-medium text-muted hover:text-[#0a0a0a] transition-all-expo"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted block mb-1 uppercase tracking-wider">Client Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1 uppercase tracking-wider">Slug</label>
                <p className="text-sm text-muted px-3 py-1.5 bg-gray-50 rounded-md font-mono">{clientConfig.id}</p>
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1 uppercase tracking-wider">Meta Page ID</label>
                <input
                  value={editPageId}
                  onChange={(e) => setEditPageId(e.target.value)}
                  placeholder="e.g. 1135528059640106"
                  className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1 uppercase tracking-wider">Meta Pixel / Dataset ID</label>
                <input
                  value={editPixelId}
                  onChange={(e) => setEditPixelId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1 uppercase tracking-wider">Token Status</label>
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
                  className="h-8 px-3 text-xs font-medium rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] transition-all-expo"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-8 px-3 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 disabled:opacity-50 transition-all-expo"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted text-[11px] uppercase tracking-wider">Name</span>
                <span className="font-medium text-[#0a0a0a]">{clientConfig.name || currentClient?.name || clientConfig.id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted text-[11px] uppercase tracking-wider">Slug</span>
                <span className="font-mono text-xs text-muted">{clientConfig.id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted text-[11px] uppercase tracking-wider">Page ID</span>
                <span className="font-mono text-xs text-muted">{clientConfig.config?.pageId || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted text-[11px] uppercase tracking-wider">Pixel/Dataset ID</span>
                <span className="font-mono text-xs text-muted">{clientConfig.config?.pixelId || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted text-[11px] uppercase tracking-wider">Token</span>
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
                  <span className="text-muted text-[11px] uppercase tracking-wider">Last synced</span>
                  <span className="text-xs text-muted">{new Date(lastResult.lastSyncedAt).toLocaleString()}</span>
                </div>
              )}
              {clientConfig.forms && clientConfig.forms.length > 0 && (
                <div className="pt-3 border-t border-card-border mt-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Imported Forms ({clientConfig.forms.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {clientConfig.forms.map((f: any) => (
                      <span key={f.formId} className="text-xs bg-gray-50 border border-card-border text-muted px-2 py-0.5 rounded-full">
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
      <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-3">Sync Meta Leads</h2>
        <p className="text-xs text-muted mb-4">Manually pull the latest leads from Meta. Dedup is automatic. CRM fields (stage, notes, tasks, history) are never overwritten.</p>
        <button
          onClick={handleImport}
          disabled={importing}
          className="h-9 px-5 bg-[#0a0a0a] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all-expo inline-flex items-center gap-2"
        >
          {importing ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Syncing...
            </>
          ) : 'Sync Meta Leads'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">{error}</div>
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
                <div key={s.label} className="bg-gray-50 border border-card-border rounded-lg p-3 transition-all-expo hover:border-[#d4d4d4]">
                  <p className="text-[10px] text-muted uppercase tracking-wider">{s.label}</p>
                  <p className="text-lg font-bold text-[#0a0a0a] tabular-nums mt-1">{s.value}</p>
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
                <p className="text-[11px] uppercase tracking-wider font-medium text-muted mb-2">Per-form breakdown</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted border-b border-card-border">
                        <th className="pb-1.5 pr-3 font-medium text-[10px] uppercase tracking-wider">Form</th>
                        <th className="pb-1.5 pr-3 font-medium text-[10px] uppercase tracking-wider">Status</th>
                        <th className="pb-1.5 pr-3 font-medium text-[10px] uppercase tracking-wider">Leads</th>
                        <th className="pb-1.5 font-medium text-[10px] uppercase tracking-wider">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayResult.forms.map((f: any) => (
                        <tr key={f.formId} className="border-b border-gray-50">
                          <td className="py-1.5 pr-3 text-muted max-w-[200px] truncate" title={f.formName}>
                            {f.formName}
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              f.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-muted'
                            }`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums text-muted">{f.leadsFetched}</td>
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
      <div className="border border-card-border rounded-xl p-5 transition-all-expo hover:border-[#d4d4d4]">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[#0a0a0a] mb-3">Data Source</h2>
        {source ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-[#0a0a0a]">Convex Cloud</span>
              <span className="text-xs text-muted">— {source.totalLeads} total leads</span>
            </div>
            <div className="flex items-center gap-3 py-1">
              <span className="w-2 h-2 rounded-full bg-[#555555]" />
              <span className="text-sm text-[#0a0a0a]">Meta Leads</span>
              <span className="text-xs text-muted">— {source.totalLeads} (100%)</span>
            </div>
            {source.byStage && Object.keys(source.byStage).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-card-border">
                {Object.entries(source.byStage).map(([stage, count]) => (
                  <span key={stage} className="text-xs bg-gray-50 border border-card-border text-muted px-2 py-0.5 rounded-full">
                    {stage}: {count as number}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">Loading...</p>
        )}
      </div>
    </div>
  )
}