import { useState, useEffect, useCallback } from 'react'
import {
  getLead, updateLeadStage, getLeadHistory,
  getLeadNotes, addLeadNote, getLeadTasks, addLeadTask, toggleLeadTask,
  getLeadEvents, sendCapiEvent, cancelCapiEvent,
getPreviewPayload,
} from './api'
import { STAGES, POSITIVE_STAGES, NEGATIVE_STAGES, DISQUALIFICATION_STAGES } from './constants'

function extractFieldValue(fieldData: any[], ...namePatterns: string[]): string {
  for (const field of fieldData || []) {
    const name = (field.name || '').toLowerCase()
    if (namePatterns.some((p) => name.includes(p.toLowerCase()))) {
      const val = field.values?.[0]
      if (val) return String(val)
    }
  }
  return ''
}

function getMetaCreatedTime(lead: any): string | null {
  return lead?.fullResponse?.created_time || null
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^+\d]/g, '')
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-card-border rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-widest font-medium text-muted mb-3">{title}</p>
      {children}
    </div>
  )
}

export default function LeadDrawer({
  leadId,
  onClose,
  onStageChange,
}: {
  leadId: string | null
  onClose: () => void
  onStageChange: () => void
}) {
  const [lead, setLead] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newNote, setNewNote] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [updatingStage, setUpdatingStage] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [retryingEvent, setRetryingEvent] = useState<string | null>(null)
  const [cancellingEvent, setCancellingEvent] = useState<string | null>(null)

  // Disqualification reason modal
  const [pendingStage, setPendingStage] = useState<string | null>(null)
  const [disqualReason, setDisqualReason] = useState('')
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [previewPayload, setPreviewPayload] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const load = useCallback(async () => {
    if (!leadId) return
    setLoading(true)
    setLoadError(null)
    try {
      const [l, h, n, t, e] = await Promise.all([
        getLead(leadId),
        getLeadHistory(leadId),
        getLeadNotes(leadId),
        getLeadTasks(leadId),
        getLeadEvents(leadId),
      ])
      setLead(l)
      setHistory(h.history || h || [])
      setNotes(n.notes || n || [])
      setTasks(t.tasks || t || [])
      setEvents(e.events || e || [])
    } catch (err: any) {
      console.error('Drawer load error:', err)
      setLoadError(err.message || 'Failed to load lead')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    if (leadId) load()
  }, [leadId, load])

  const doStageChange = async (stage: string, reason?: string) => {
    if (!leadId || stage === lead?.stage) return
    setUpdatingStage(true)
    try {
      await updateLeadStage(leadId, stage, reason)
      onStageChange()
      await load()
    } catch (err) {
      console.error('Stage update error:', err)
    } finally {
      setUpdatingStage(false)
    }
  }

  const handleStageClick = (stage: string) => {
    if (stage === lead?.stage) return
    if (DISQUALIFICATION_STAGES.has(stage)) {
      setPendingStage(stage)
      setDisqualReason('')
    } else {
      doStageChange(stage)
    }
  }

  const handleConfirmDisqual = () => {
    if (pendingStage) {
      doStageChange(pendingStage, disqualReason.trim() || undefined)
      setPendingStage(null)
      setDisqualReason('')
    }
  }

  const handleAddNote = async () => {
    if (!leadId || !newNote.trim()) return
    try {
      await addLeadNote(leadId, newNote.trim())
      setNewNote('')
      await load()
    } catch (err) {
      console.error('Add note error:', err)
    }
  }

  const handleAddTask = async () => {
    if (!leadId || !newTask.trim()) return
    try {
      await addLeadTask(leadId, newTask.trim(), newTaskDueDate || undefined)
      setNewTask('')
      setNewTaskDueDate('')
      await load()
    } catch (err) {
      console.error('Add task error:', err)
    }
  }

  const handleToggleTask = async (taskId: string, done: boolean) => {
    if (!leadId) return
    try {
      await toggleLeadTask(leadId, taskId, done)
      await load()
    } catch (err) {
      console.error('Toggle task error:', err)
    }
  }

  const handleRetryEvent = async (eventId: string) => {
    setRetryingEvent(eventId)
    try {
      await sendCapiEvent(eventId)
      await load()
    } catch (err: any) {
      console.error('Event retry error:', err)
    } finally {
      setRetryingEvent(null)
    }
  }

  const handleCancelEvent = async (eventId: string) => {
    setCancellingEvent(eventId)
    try {
      await cancelCapiEvent(eventId)
      await load()
    } catch (err: any) {
      console.error('Event cancel error:', err)
    } finally {
      setCancellingEvent(null)
    }
  }

  const handlePreviewPayload = async () => {
    if (!leadId || previewLoading) return
    setPreviewLoading(true)
    try {
      const data = await getPreviewPayload(leadId)
      setPreviewPayload(data)
    } catch (err: any) {
      console.error('Preview payload error:', err)
      setPreviewPayload({ error: err.message || 'Failed to load preview' })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedLabel(label)
      setTimeout(() => setCopiedLabel(null), 1500)
    } catch { /* clipboard not available */ }
  }

  const buildLeadSummary = (): string => {
    const fieldData = lead?.fieldData || []
    const budget = extractFieldValue(fieldData, 'budget')
    const purpose = extractFieldValue(fieldData, 'purpose', 'why_are_you', 'exploring')
    const metaCreated = getMetaCreatedTime(lead)
    return [
      `Name: ${lead?.name || '—'}`,
      `Phone: ${lead?.phone || '—'}`,
      `Budget: ${budget || '—'}`,
      `Purpose: ${purpose || '—'}`,
      `Stage: ${lead?.stage || '—'}`,
      `Meta Created: ${metaCreated ? new Date(metaCreated).toLocaleDateString() : '—'}`,
      `Source: ${lead?.platform || 'meta'}`,
    ].join('\n')
  }

  if (!leadId) return null

  const fieldData = lead?.fieldData || []
  const budget = extractFieldValue(fieldData, 'budget')
  const purpose = extractFieldValue(fieldData, 'purpose', 'why_are_you', 'exploring')
  const metaCreated = getMetaCreatedTime(lead)
  const isTestLead = lead?.name && lead.name.includes('test lead: dummy data')
  const phone = lead?.phone || ''
  const cleanedPhone = cleanPhone(phone)
  const isWaPhone = cleanedPhone.startsWith('+') || cleanedPhone.startsWith('1') || cleanedPhone.length >= 10

  // Sort tasks: pending first, then done
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return 0
  })

  const statusDot = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#a0a0a0',
      sent: '#0a0a0a',
      failed: '#dc2626',
      skipped: '#a0a0a0',
      dry_run: '#a0a0a0',
      cancelled: '#6b7280',
    }
    return colors[status] || '#a0a0a0'
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[#0a0a0a] tracking-tight truncate">{lead?.name || 'Unnamed Lead'}</h2>
                {isTestLead && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-muted text-muted shrink-0">Test</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted">{phone || lead?.email || 'No contact info'}</span>
                <span className="text-muted">·</span>
                <span className="text-xs text-muted">{lead?.platform || 'meta'}</span>
                <span className="text-muted">·</span>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${POSITIVE_STAGES.has(lead?.stage) ? 'bg-[#0a0a0a] text-white' : NEGATIVE_STAGES.has(lead?.stage) ? 'bg-[#f5f5f5] text-[#8b8b8b] border border-card-border' : 'bg-white text-[#6b6b6b] border border-[#e5e5e5]'}`}>{lead?.stage || '—'}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-muted hover:text-[#0a0a0a] text-lg leading-none ml-3 transition-all-expo">&times;</button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] transition-all-expo no-underline"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call
              </a>
            )}
            {phone && isWaPhone && (
              <a
                href={`https://wa.me/${cleanedPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] transition-all-expo no-underline"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            )}
            {phone && (
              <button
                onClick={() => handleCopy(phone, 'phone')}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] transition-all-expo"
              >
                {copiedLabel === 'phone' ? 'Copied!' : 'Copy phone'}
              </button>
            )}
            {lead?.metaLeadId && (
              <button
                onClick={() => handleCopy(lead.metaLeadId, 'metaId')}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] transition-all-expo"
              >
                {copiedLabel === 'metaId' ? 'Copied!' : 'Copy Meta ID'}
              </button>
            )}
            <button
              onClick={handlePreviewPayload}
              disabled={previewLoading}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] transition-all-expo disabled:opacity-50"
            >
              {previewLoading ? 'Loading...' : 'Preview Meta Payload'}
            </button>
            <button
              onClick={() => handleCopy(buildLeadSummary(), 'summary')}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] hover:border-[#d4d4d4] transition-all-expo"
            >
              {copiedLabel === 'summary' ? 'Copied!' : 'Copy summary'}
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-muted py-12 text-center">Loading lead details...</div>
          ) : loadError ? (
            <div className="text-sm text-red-500 py-12 text-center">
              <p>Failed to load lead</p>
              <p className="text-xs text-muted mt-2">Requested ID: {leadId}</p>
              <p className="text-xs text-muted mt-1">Error: {loadError}</p>
            </div>
          ) : !lead ? (
            <div className="text-sm text-red-500 py-12 text-center">
              <p>Lead not found</p>
              <p className="text-xs text-muted mt-2">ID: {leadId}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* === CRM STATUS === */}
              <SectionBox title="CRM Status">
                <div>
                  <p className="text-xs text-muted mb-2">Current Stage</p>
                  <div className="flex flex-wrap gap-1">
                    {STAGES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => handleStageClick(s.key)}
                        disabled={updatingStage}
                        className={`text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-all-expo ${
                          s.key === lead.stage
                            ? 'bg-[#0a0a0a] text-white'
                            : updatingStage
                              ? 'bg-gray-100 text-muted cursor-wait'
                              : 'bg-white text-muted hover:bg-[#f5f5f5] hover:text-[#0a0a0a] border border-card-border'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {updatingStage && (
                    <p className="text-xs text-muted mt-2 italic">Saving...</p>
                  )}
                </div>
                {lead.stageChangedAt && (
                  <p className="text-xs text-muted mt-2">
                    Last changed: {new Date(lead.stageChangedAt).toLocaleString()}
                  </p>
                )}
              </SectionBox>

              {/* === CONTACT === */}
              <SectionBox title="Contact">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-[11px] uppercase tracking-wider">Phone</span>
                    <p className="text-[#0a0a0a] text-sm mt-0.5">{phone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[11px] uppercase tracking-wider">Email</span>
                    <p className="text-[#0a0a0a] text-sm mt-0.5">{lead.email || '—'}</p>
                  </div>
                </div>
              </SectionBox>

              {/* === QUALIFICATION === */}
              <SectionBox title="Qualification">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-[11px] uppercase tracking-wider">Budget</span>
                    <p className="text-[#0a0a0a] text-sm mt-0.5">{budget || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[11px] uppercase tracking-wider">Purpose</span>
                    <p className="text-[#0a0a0a] text-sm mt-0.5">{purpose || '—'}</p>
                  </div>
                </div>
              </SectionBox>

              {/* === TECHNICAL METADATA === */}
              <SectionBox title="Technical Metadata">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Meta Lead ID</span>
                    <p className="text-[#0a0a0a] text-xs font-mono mt-0.5">{lead.metaLeadId || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Convex ID</span>
                    <p className="text-[#0a0a0a] text-xs font-mono mt-0.5 truncate" title={lead._id}>{lead._id}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Campaign</span>
                    <p className="text-[#0a0a0a] text-xs mt-0.5">{lead.campaignName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Ad</span>
                    <p className="text-[#0a0a0a] text-xs mt-0.5">{lead.adName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Ad Set</span>
                    <p className="text-[#0a0a0a] text-xs mt-0.5">{lead.adSetName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Form</span>
                    <p className="text-[#0a0a0a] text-xs mt-0.5">{lead.formName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Meta Page ID</span>
                    <p className="text-[#0a0a0a] text-xs font-mono mt-0.5">{lead.pageId || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Source</span>
                    <p className="text-[#0a0a0a] text-xs mt-0.5">{lead.platform || 'meta'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Meta Created</span>
                    <p className="text-[#0a0a0a] text-xs mt-0.5">{metaCreated ? new Date(metaCreated).toLocaleString() : '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider">Imported At</span>
                    <p className="text-[#0a0a0a] text-xs mt-0.5">{lead.ingestedAt ? new Date(lead.ingestedAt).toLocaleString() : '—'}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-card-border">
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-[11px] font-medium text-muted hover:text-[#0a0a0a] transition-all-expo"
                  >
                    {showRaw ? 'Hide' : 'Show'} raw field data
                  </button>
                  {showRaw && fieldData.length > 0 && (
                    <div className="mt-2 text-xs bg-[#fafafa] rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto border border-card-border">
                      {fieldData.map((f: any, i: number) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-medium text-muted">{f.name}:</span>
                          <span className="text-[#0a0a0a]">{(f.values || []).join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionBox>

              {/* === NOTES === */}
              <SectionBox title="Notes">
                <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted italic py-2">No notes yet</p>
                  ) : (
                    notes.map((n: any) => (
                      <div key={n._id} className="text-xs bg-[#fafafa] rounded-lg p-2.5 border border-card-border">
                        <p className="text-[#0a0a0a]">{n.content}</p>
                        <p className="text-muted mt-0.5 text-[10px]">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add a note..."
                    className="flex-1 text-xs border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
                  />
                  <button onClick={handleAddNote} className="px-3 py-1.5 bg-[#0a0a0a] text-white text-xs rounded-md hover:opacity-90 transition-all-expo shrink-0 font-medium">Add</button>
                </div>
              </SectionBox>

              {/* === TASKS === */}
              <SectionBox title="Tasks">
                <div className="space-y-1.5 max-h-48 overflow-y-auto mb-2">
                  {sortedTasks.length === 0 ? (
                    <p className="text-xs text-muted italic py-2">No tasks yet</p>
                  ) : (
                    sortedTasks.map((t: any) => (
                      <div key={t._id} className={`flex items-center gap-2 text-xs rounded-lg p-2 border ${t.done ? 'bg-white border-card-border opacity-60' : 'bg-[#fafafa] border-card-border'}`}>
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => handleToggleTask(t._id, !t.done)}
                          className="rounded border-card-border accent-[#0a0a0a] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className={t.done ? 'line-through text-muted' : 'text-[#0a0a0a]'}>{t.content}</span>
                          <div className="flex gap-2 mt-0.5">
                            {t.dueDate && (
                              <span className={`text-[10px] ${new Date(t.dueDate) < new Date() && !t.done ? 'text-red-500' : 'text-muted'}`}>
                                Due: {new Date(t.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {t.createdAt && (
                              <span className="text-[10px] text-muted">{new Date(t.createdAt).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="Add a task..."
                    className="flex-1 text-xs border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
                  />
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="text-xs border border-card-border rounded-md px-2 py-1.5 bg-white text-muted focus:outline-none focus:border-[#0a0a0a] w-[120px]"
                    title="Due date (optional)"
                  />
                  <button onClick={handleAddTask} className="px-3 py-1.5 bg-[#0a0a0a] text-white text-xs rounded-md hover:opacity-90 transition-all-expo shrink-0 font-medium">Add</button>
                </div>
              </SectionBox>

              {/* === STAGE HISTORY === */}
              <SectionBox title="Stage History">
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted italic py-2">No stage changes yet</p>
                  ) : (
                    history.map((h: any) => (
                      <div key={h._id} className="text-xs bg-[#fafafa] rounded-lg p-2 border border-card-border">
                        <div className="flex justify-between items-center">
                          <span className="text-[#0a0a0a] font-medium text-xs">
                            {h.fromStage === 'new' ? 'Lead' : h.fromStage}
                            <span className="text-muted mx-1">→</span>
                            {h.toStage === 'new' ? 'Lead' : h.toStage}
                          </span>
                          <span className="text-muted text-[10px]">{new Date(h.changedAt).toLocaleString()}</span>
                        </div>
                        {h.reason && (
                          <p className="text-muted mt-0.5 text-[10px]">Reason: {h.reason}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </SectionBox>

              {/* === CRM EVENT HISTORY === */}
              <SectionBox title="CRM Event History">
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="text-xs text-muted italic py-2">No CRM events yet. Changing to ConversionLead or Purchase creates an event.</p>
                  ) : (
                    events.map((ev: any) => (
                      <div key={ev._id} className="text-xs bg-[#fafafa] rounded-lg p-2 border border-card-border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#0a0a0a] text-xs">{ev.eventName}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusDot(ev.status) }} />
                            {ev.status}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1 text-muted">
                          <span className="text-[10px]">Stage: {ev.stage}</span>
                          <span className="text-[10px]">{new Date(ev.createdAt).toLocaleString()}</span>
                        </div>
                        {ev.attempts > 0 && <p className="text-muted text-[10px] mt-0.5">Attempts: {ev.attempts}</p>}
                        {ev.error && <p className="text-red-500 text-[10px] mt-0.5">Error: {ev.error}</p>}
                        {(ev.status === 'pending') && (
                          <div className="mt-1.5 flex gap-2">
                            <button
                              onClick={() => handleCancelEvent(ev._id)}
                              disabled={cancellingEvent === ev._id}
                              className="text-[10px] font-medium text-red-500 hover:text-red-700 transition-all-expo disabled:opacity-50"
                            >
                              {cancellingEvent === ev._id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </div>
                        )}
                        {(ev.status === 'failed') && (
                          <div className="mt-1.5 flex gap-2">
                            <button
                              onClick={() => handleRetryEvent(ev._id)}
                              disabled={retryingEvent === ev._id}
                              className="text-[10px] font-medium text-muted hover:text-[#0a0a0a] transition-all-expo disabled:opacity-50"
                            >
                              {retryingEvent === ev._id ? 'Retrying...' : 'Retry'}
                            </button>
                            <button
                              onClick={() => handleCancelEvent(ev._id)}
                              disabled={cancellingEvent === ev._id}
                              className="text-[10px] font-medium text-red-500 hover:text-red-700 transition-all-expo disabled:opacity-50"
                            >
                              {cancellingEvent === ev._id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </SectionBox>
            </div>
          )}
        </div>
      </div>

      {/* Disqualification Reason Modal */}
      {pendingStage && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[60]" onClick={() => setPendingStage(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl border border-card-border p-6 z-[70] w-[400px] max-w-[90vw]">
            <h3 className="text-sm font-semibold text-[#0a0a0a] mb-2">
              Change stage to {STAGES.find((s) => s.key === pendingStage)?.label || pendingStage}?
            </h3>
            <p className="text-xs text-muted mb-4">Optionally add a reason for this change.</p>
            <textarea
              value={disqualReason}
              onChange={(e) => setDisqualReason(e.target.value)}
              placeholder="Reason (optional)..."
              rows={3}
              className="w-full text-xs border border-card-border rounded-md px-3 py-2 focus:outline-none focus:border-[#0a0a0a] transition-all-expo resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setPendingStage(null)}
                className="px-4 py-2 text-xs font-medium rounded-md border border-card-border bg-white text-muted hover:text-[#0a0a0a] transition-all-expo"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisqual}
                disabled={updatingStage}
                className="px-4 py-2 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 disabled:opacity-50 transition-all-expo"
              >
                {updatingStage ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Meta Payload Preview Modal */}
      {previewPayload && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[60]" onClick={() => setPreviewPayload(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl border border-card-border p-6 z-[70] w-[480px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#0a0a0a">Meta Payload Preview</h3>
              <button onClick={() => setPreviewPayload(null)} className="text-muted hover:text-[#0a0a0a] text-lg leading-none transition-all-expo">&times;</button>
            </div>

            {previewPayload.error ? (
              <p className="text-xs text-red-500">{previewPayload.error}</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-amber-800 font-medium text-[11px]">{previewPayload.warning}</p>
                </div>

                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Lead Info</p>
                  <div className="space-y-0.5">
                    <p><span className="text-muted">Name:</span> {previewPayload.name || '—'}</p>
                    <p><span className="text-muted">Meta Lead ID:</span> {previewPayload.metaLeadId || '—'}</p>
                    <p><span className="text-muted">Phone available:</span> {previewPayload.phoneAvailable ? 'Yes' : 'No'}</p>
                    <p><span className="text-muted">Email available:</span> {previewPayload.emailAvailable ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">user_data (redacted hashes)</p>
                  <div className="bg-[#fafafa] rounded-lg p-3 border border-card-border space-y-0.5 font-mono text-[11px]">
                    {Object.keys(previewPayload.userData || {}).length === 0 ? (
                      <p className="text-muted italic">No user_data fields available</p>
                    ) : (
                      Object.entries(previewPayload.userData || {}).map(([key, val]) => (
                        <p key={key}>{key}: {val as string}</p>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">custom_data</p>
                  <div className="bg-[#fafafa] rounded-lg p-3 border border-card-border space-y-0.5 font-mono text-[11px]">
                    {Object.entries(previewPayload.customData || {}).map(([key, val]) => (
                      <p key={key}>{key}: {val !== undefined && val !== null ? String(val) : '—'}</p>
                    ))}
                  </div>
                </div>

                {previewPayload.fieldsMissing?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Missing fields</p>
                    <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                      {previewPayload.fieldsMissing.map((f: string, i: number) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setPreviewPayload(null)}
                className="px-4 py-2 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 transition-all-expo"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}