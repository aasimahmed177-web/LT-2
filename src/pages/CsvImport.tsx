import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { previewCsv, applyCsv } from '../api'

const CAPI_STAGES = new Set(['Contact', 'Prospect', 'ConversionLead', 'Purchase'])

function stagePill(stage: string | null): { className: string; label: string } {
  if (!stage) return { className: 'stage-badge stage-Lead', label: '—' }
  return { className: `stage-badge stage-${stage}`, label: stage }
}

export default function CsvImport() {
  const navigate = useNavigate()
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [applyResult, setApplyResult] = useState<any>(null)
  const [applying, setApplying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      handlePreview(text)
    }
    reader.readAsText(file)
    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  const handleDropZoneClick = () => {
    fileInputRef.current?.click()
  }

  const handlePasteUpload = () => {
    if (!csvText.trim()) return
    handlePreview(csvText)
  }

  const handlePreview = async (text: string) => {
    setLoading(true)
    setPreview(null)
    setApplyResult(null)
    try {
      const result = await previewCsv(text)
      setPreview(result)
    } catch (err: any) {
      console.error('Preview error:', err)
      setPreview({ error: err.message || 'Failed to preview CSV' })
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!preview?.rows || preview.rows.length === 0) return
    setApplying(true)
    setShowConfirm(false)
    try {
      const result = await applyCsv(preview.rows)
      setApplyResult(result)
    } catch (err: any) {
      console.error('Apply error:', err)
      setApplyResult({ error: err.message || 'Failed to apply CSV updates' })
    } finally {
      setApplying(false)
    }
  }

  const handleReset = () => {
    setCsvText('')
    setPreview(null)
    setApplyResult(null)
    setShowConfirm(false)
  }

  const summary = preview?.summary
  const previewRows = preview?.rows || []
  const needsApply = summary?.stageChanges > 0 || summary?.capiTriggering > 0
  const hasResult = !!applyResult

  const applyDisabled = !preview || preview.error || !needsApply || applying || hasResult

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">CSV Import</h1>
        <p className="text-sm text-muted mt-0.5">Import Google Sheet exports to update CRM stages, create CAPI events, and store call activity data.</p>
      </div>

      {/* ── Upload Area ───────────────────────────────────────────── */}
      {(() => {
        // Show upload area if there's no preview and no result (or user reset)
        if (preview || loading || hasResult) return null

        return (
          <div className="border-2 border-dashed border-card-border rounded-xl p-8 space-y-5">
            <div className="text-center">
              <p className="text-sm font-medium text-[#0a0a0a]">Upload CSV file</p>
              <p className="text-xs text-muted mt-1">or paste CSV text below</p>
            </div>

            {/* Hidden file input + styled drop zone */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex justify-center">
              <button
                onClick={handleDropZoneClick}
                className="px-6 py-3 text-sm font-medium rounded-lg border-2 border-dashed border-card-border bg-[#fafafa] text-muted hover:text-[#0a0a0a] hover:border-[#0a0a0a] transition-all-expo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-2 -mt-0.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                Choose CSV file
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-card-border" />
              <span className="text-xs text-muted">or</span>
              <div className="flex-1 h-px bg-card-border" />
            </div>

            <div className="space-y-2">
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV text here..."
                rows={6}
                className="w-full text-xs border border-card-border rounded-lg px-4 py-3 focus:outline-none focus:border-[#0a0a0a] transition-all-expo resize-none font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCsvText('')}
                  className="px-4 py-2 text-xs font-medium rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] transition-all-expo"
                  disabled={!csvText.trim()}
                >
                  Clear
                </button>
                <button
                  onClick={handlePasteUpload}
                  className="px-4 py-2 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 disabled:opacity-50 transition-all-expo"
                  disabled={!csvText.trim()}
                >
                  Preview
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Loading State ─────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-muted text-sm">Analyzing CSV...</div>
        </div>
      )}

      {/* ── Error State ──────────────────────────────────────────── */}
      {preview?.error && !loading && !hasResult && (
        <div className="warning-banner border border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-700">Preview Error</p>
          <p className="text-xs text-red-600 mt-1">{preview.error}</p>
          <button onClick={handleReset} className="mt-3 px-4 py-2 text-xs font-medium rounded-md bg-white border border-red-200 text-red-700 hover:bg-red-50 transition-all-expo">
            Try again
          </button>
        </div>
      )}

      {/* ── Preview Section ──────────────────────────────────────── */}
      {preview && !preview.error && !loading && !hasResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-4 gap-4">
              <div className="kpi-card">
                <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Total Rows</p>
                <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums leading-none">{summary.total}</p>
              </div>
              <div className="kpi-card">
                <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Matched</p>
                <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums leading-none">{summary.matched}</p>
                <p className="text-xs text-muted mt-1">{summary.unmatched} unmatched</p>
              </div>
              <div className="kpi-card">
                <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Stage Changes</p>
                <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums leading-none">{summary.stageChanges}</p>
                <p className="text-xs text-muted mt-1">{summary.noChanges} unchanged</p>
              </div>
              <div className="kpi-card">
                <p className="text-[10px] text-muted font-medium uppercase tracking-wider">CAPI Triggering</p>
                <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums leading-none">{summary.capiTriggering}</p>
                <p className="text-xs text-muted mt-1">{summary.invalidStages} invalid stages</p>
              </div>
            </div>
          )}

          {/* Column Detection Info */}
          {preview.detectedColumns && (
            <div className="border border-card-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest font-medium text-muted mb-2">Detected Columns</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                {Object.entries(preview.detectedColumns).map(([key, val]) => (
                  <span key={key} className={`px-2 py-1 rounded-md border ${val ? 'border-card-border bg-[#fafafa] text-[#0a0a0a]' : 'border-transparent bg-gray-50 text-muted/50'}`}>
                    {key}: <span className="font-medium">{String(val || '—')}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-card-border bg-[#fafafa] flex items-center justify-between">
              <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Preview ({previewRows.length} rows)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth: '1100px' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Meta Lead ID</th>
                    <th>Lead Name</th>
                    <th>Current Stage</th>
                    <th>New Stage</th>
                    <th>Change?</th>
                    <th>CAPI?</th>
                    <th>Matched?</th>
                    <th>Call Comment</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row: any) => {
                    const currentPill = stagePill(row.currentStage)
                    const newPill = stagePill(row.newStage)
                    return (
                      <tr key={row.csvRow} className={row.unmatched ? 'opacity-50' : ''}>
                        <td className="text-muted text-xs">{row.csvRow}</td>
                        <td className="font-mono text-xs max-w-[120px] truncate" title={row.metaLeadId}>{row.metaLeadId}</td>
                        <td className="font-medium text-[#0a0a0a]">{row.leadName || <span className="text-muted italic">—</span>}</td>
                        <td>
                          {row.currentStage ? (
                            <span className={currentPill.className}>{currentPill.label}</span>
                          ) : (
                            <span className="text-muted text-xs italic">—</span>
                          )}
                        </td>
                        <td>
                          {row.newStage ? (
                            <span className={newPill.className}>{newPill.label}</span>
                          ) : (
                            <span className="text-muted text-xs italic">—</span>
                          )}
                        </td>
                        <td>
                          {row.stageWillChange ? (
                            <span className="text-[11px] font-medium text-[#0a0a0a]">Yes</span>
                          ) : row.currentStage === row.newStage ? (
                            <span className="text-[11px] text-muted">No</span>
                          ) : (
                            <span className="text-[11px] text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {row.capiTriggered ? (
                            <span className="event-pill-sent text-[10px]">Yes</span>
                          ) : row.stageWillChange ? (
                            <span className="text-[11px] text-muted">No CAPI</span>
                          ) : (
                            <span className="text-[11px] text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {row.unmatched ? (
                            <span className="text-[11px] text-amber-600 font-medium">Unmatched</span>
                          ) : (
                            <span className="text-[11px] text-[#0a0a0a]">Matched</span>
                          )}
                        </td>
                        <td className="max-w-[180px]">
                          {row.callComment ? (
                            <span className="text-xs text-muted truncate block" title={row.callComment}>
                              {row.callComment}
                            </span>
                          ) : (
                            <span className="text-xs text-muted italic">—</span>
                          )}
                        </td>
                        <td>
                          {row.validationError ? (
                            <span className="text-[11px] text-red-500">{row.validationError}</span>
                          ) : row.stageWillChange ? (
                            <span className="text-[11px] text-green-600">Valid</span>
                          ) : (
                            <span className="text-[11px] text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-muted text-xs">No data rows found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky Action Bar ────────────────────────────────────── */}
      {preview && !preview.error && !loading && !hasResult && (
        <div className="sticky bottom-0 z-30 -mx-8 px-8 pb-6 pt-4 bg-gradient-to-t from-white via-white to-transparent">
          <div className="flex items-center gap-3 rounded-xl border border-card-border bg-white shadow-lg p-4">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={applyDisabled}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-[#0a0a0a] text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all-expo"
            >
              {applying ? 'Applying...' : `Apply updates — ${summary?.stageChanges || 0} stages`}
            </button>
            <button
              onClick={handleReset}
              disabled={applying}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-card-border bg-white text-muted hover:text-[#0a0a0a] transition-all-expo disabled:opacity-50"
            >
              Start over
            </button>
            {!needsApply && previewRows.length > 0 && (
              <p className="text-xs text-muted italic ml-2">No stage changes detected — nothing to apply.</p>
            )}
            <div className="flex-1 text-right text-xs text-muted">
              {summary?.matched || 0} matched · {summary?.stageChanges || 0} changes · {summary?.capiTriggering || 0} CAPI
            </div>
          </div>
        </div>
      )}

      {/* ── Apply Result ─────────────────────────────────────────── */}
      {applyResult && (
        <div className="space-y-6">
          {applyResult.error ? (
            <div className="border border-red-200 bg-red-50 rounded-xl p-6">
              <p className="text-sm font-medium text-red-700">Apply Error</p>
              <p className="text-xs text-red-600 mt-1">{applyResult.error}</p>
              <button onClick={handleReset} className="mt-4 px-4 py-2 text-xs font-medium rounded-md bg-white border border-red-200 text-red-700 hover:bg-red-50 transition-all-expo">
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* Success banner */}
              <div className="border border-green-200 bg-green-50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-green-800">Import Complete</p>
                    <p className="text-xs text-green-600">Stage changes, notes, and CAPI events have been applied</p>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                    <span className="text-[10px] text-muted uppercase tracking-wider">Updated</span>
                    <p className="text-2xl font-bold tabular-nums text-green-700">{applyResult.summary?.updated || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                    <span className="text-[10px] text-muted uppercase tracking-wider">Notes Added</span>
                    <p className="text-2xl font-bold tabular-nums">{applyResult.summary?.notesAdded || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                    <span className="text-[10px] text-muted uppercase tracking-wider">Call Activities</span>
                    <p className="text-2xl font-bold tabular-nums">{applyResult.summary?.callActivitiesStored || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                    <span className="text-[10px] text-muted uppercase tracking-wider">CAPI Events</span>
                    <p className="text-2xl font-bold tabular-nums">{applyResult.summary?.capiEventsCreated || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                    <span className="text-[10px] text-muted uppercase tracking-wider">Errors</span>
                    <p className={`text-2xl font-bold tabular-nums ${applyResult.summary?.errors > 0 ? 'text-red-500' : 'text-green-600'}`}>{applyResult.summary?.errors || 0}</p>
                  </div>
                </div>
                {applyResult.summary?.capiEventsCreated > 0 && (
                  <div className="mt-4 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
                    CAPI events are created in <strong>pending</strong> status and will not be sent automatically.{' '}
                    <button
                      onClick={() => navigate('/events')}
                      className="underline font-medium hover:text-amber-900"
                    >
                      Review and send from the Events page
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[#0a0a0a] text-white hover:opacity-90 transition-all-expo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1.5 -mt-0.5">
                    <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
                  </svg>
                  View Dashboard
                </button>
                <button
                  onClick={() => navigate('/leads')}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg border border-card-border bg-white text-muted hover:text-[#0a0a0a] transition-all-expo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1.5 -mt-0.5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  View Leads
                </button>
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg border border-card-border bg-white text-muted hover:text-[#0a0a0a] transition-all-expo"
                >
                  Import another file
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Confirmation Modal ───────────────────────────────────── */}
      {showConfirm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[60]" onClick={() => setShowConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl border border-card-border p-6 z-[70] w-[420px] max-w-[90vw]">
            <h3 className="text-sm font-semibold text-[#0a0a0a] mb-2">Confirm CSV Import</h3>
            <p className="text-xs text-muted mb-4">
              This will update <strong>{summary?.stageChanges || 0} CRM stages</strong> and may create/send{' '}
              <strong>{summary?.capiTriggering || 0} CAPI events</strong> depending on current CAPI mode.
              Call activity data will be stored for reporting. No leads will be created.
            </p>
            <div className="space-y-1.5 text-xs text-muted bg-[#fafafa] rounded-lg p-3 border border-card-border mb-4">
              <p>• {summary?.matched || 0} matched leads will be updated</p>
              <p>• {summary?.unmatched || 0} unmatched rows will be skipped</p>
              <p>• {summary?.stageChanges || 0} stage changes + history recorded</p>
              <p>• {summary?.capiTriggering || 0} CAPI events may be triggered</p>
              <p>• Call comments will be added as notes (non-duplicate)</p>
              <p>• Telecalling reporting fields will be stored</p>
              <p className="text-amber-600">• This action cannot be undone</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-medium rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] transition-all-expo"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-4 py-2 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 disabled:opacity-50 transition-all-expo"
              >
                {applying ? 'Applying...' : 'Apply updates'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}