import { useState, useEffect, useCallback } from 'react'
import {
  getLead, updateLeadStage, getLeadHistory,
  getLeadNotes, addLeadNote, getLeadTasks, addLeadTask, toggleLeadTask,
  getLeadEvents,
} from './api'

const STAGES = [
  { key: 'Lead', label: 'Lead' },
  { key: 'Contact', label: 'Contact' },
  { key: 'Prospect', label: 'Prospect' },
  { key: 'ConversionLead', label: 'Conversion Lead' },
  { key: 'Purchase', label: 'Purchase' },
  { key: 'NotQualified', label: 'Not Qualified' },
  { key: 'NoResponse', label: 'No Response' },
  { key: 'Duplicate', label: 'Duplicate' },
  { key: 'Invalid', label: 'Invalid' },
]

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

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-card-border rounded-lg p-4">
      <p className="text-[11px] uppercase tracking-widest font-medium text-muted mb-3">{title}</p>
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
  const [updatingStage, setUpdatingStage] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

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

  const handleStageChange = async (stage: string) => {
    if (!leadId || stage === lead?.stage) return
    setUpdatingStage(true)
    try {
      await updateLeadStage(leadId, stage)
      onStageChange()
      await load()
    } catch (err) {
      console.error('Stage update error:', err)
    } finally {
      setUpdatingStage(false)
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
      await addLeadTask(leadId, newTask.trim())
      setNewTask('')
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

  if (!leadId) return null

  const fieldData = lead?.fieldData || []
  const budget = extractFieldValue(fieldData, 'budget')
  const purpose = extractFieldValue(fieldData, 'purpose', 'why_are_you', 'exploring')
  const metaCreated = getMetaCreatedTime(lead)
  const isTestLead = lead?.name && lead.name.includes('test lead: dummy data')

  const statusDot = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#a0a0a0',
      sent: '#0a0a0a',
      failed: '#dc2626',
    }
    return colors[status] || '#a0a0a0'
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[#0a0a0a] tracking-tight">{lead?.name || 'Unnamed Lead'}</h2>
                {isTestLead && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-muted text-muted">
                    Test
                  </span>
                )}
              </div>
              {lead?.metaLeadId && (
                <p className="text-xs text-muted font-mono mt-0.5">Meta ID: {lead.metaLeadId}</p>
              )}
              {lead?._id && (
                <p className="text-[10px] text-[#d4d4d4] font-mono mt-0.5">DB ID: {lead._id}</p>
              )}
            </div>
            <button onClick={onClose} className="text-muted hover:text-[#0a0a0a] text-xl leading-none">&times;</button>
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
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => handleStageChange(s.key)}
                        disabled={updatingStage || s.key === lead.stage}
                        className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-all ${
                          s.key === lead.stage
                            ? 'bg-[#0a0a0a] text-white'
                            : 'bg-white text-muted hover:bg-[#f5f5f5] hover:text-[#0a0a0a] border border-card-border'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
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
                    <span className="text-muted text-xs">Phone</span>
                    <p className="text-[#0a0a0a]">{lead.phone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Email</span>
                    <p className="text-[#0a0a0a]">{lead.email || '—'}</p>
                  </div>
                </div>
              </SectionBox>

              {/* === QUALIFICATION === */}
              <SectionBox title="Qualification">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-xs">Budget</span>
                    <p className="text-[#0a0a0a]">{budget || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Purpose</span>
                    <p className="text-[#0a0a0a]">{purpose || '—'}</p>
                  </div>
                </div>
              </SectionBox>

              {/* === CAMPAIGN SOURCE === */}
              <SectionBox title="Campaign Source">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-xs">Campaign</span>
                    <p className="text-[#0a0a0a]">{lead.campaignName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Ad</span>
                    <p className="text-[#0a0a0a]">{lead.adName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Ad Set</span>
                    <p className="text-[#0a0a0a]">{lead.adSetName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Source</span>
                    <p className="text-[#0a0a0a]">{lead.platform || 'meta'}</p>
                  </div>
                </div>
              </SectionBox>

              {/* === META / SYSTEM DATA === */}
              <SectionBox title="Meta / System Data">
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted text-xs">Meta Lead ID</span>
                    <p className="text-[#0a0a0a] font-mono text-xs">{lead.metaLeadId || '—'}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted text-xs">Meta Page ID</span>
                    <p className="text-[#0a0a0a] font-mono text-xs">{lead.pageId || '—'}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted text-xs">Meta Created</span>
                    <p className="text-[#0a0a0a] text-xs">{metaCreated ? new Date(metaCreated).toLocaleString() : '—'}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted text-xs">Imported At</span>
                    <p className="text-[#0a0a0a] text-xs">{lead.ingestedAt ? new Date(lead.ingestedAt).toLocaleString() : '—'}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-xs font-medium text-muted hover:text-[#0a0a0a] transition-colors"
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
                <div className="space-y-2 max-h-36 overflow-y-auto mb-2">
                  {notes.length === 0 && <p className="text-xs text-muted">No notes</p>}
                  {notes.map((n: any) => (
                    <div key={n._id} className="text-xs bg-[#fafafa] rounded-lg p-2.5 border border-card-border">
                      <p className="text-[#0a0a0a]">{n.content}</p>
                      <p className="text-muted mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add a note..."
                    className="flex-1 text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-colors"
                  />
                  <button onClick={handleAddNote} className="px-3 py-1.5 bg-accent text-white text-xs rounded-md hover:opacity-90">Add</button>
                </div>
              </SectionBox>

              {/* === TASKS === */}
              <SectionBox title="Tasks">
                <div className="space-y-1.5 max-h-36 overflow-y-auto mb-2">
                  {tasks.length === 0 && <p className="text-xs text-muted">No tasks</p>}
                  {tasks.map((t: any) => (
                    <div key={t._id} className="flex items-center gap-2 text-sm bg-[#fafafa] rounded-lg p-2 border border-card-border">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => handleToggleTask(t._id, !t.done)}
                        className="rounded border-card-border accent-[#0a0a0a]"
                      />
                      <span className={t.done ? 'line-through text-muted' : 'text-[#0a0a0a]'}>{t.content}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="Add a task..."
                    className="flex-1 text-sm border border-card-border rounded-md px-3 py-1.5 focus:outline-none focus:border-[#0a0a0a] transition-colors"
                  />
                  <button onClick={handleAddTask} className="px-3 py-1.5 bg-accent text-white text-xs rounded-md hover:opacity-90">Add</button>
                </div>
              </SectionBox>

              {/* === STAGE HISTORY === */}
              <SectionBox title="Stage History">
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted">No stage changes yet</p>
                  ) : (
                    history.map((h: any) => (
                      <div key={h._id} className="text-xs bg-[#fafafa] rounded-lg p-2 flex justify-between border border-card-border">
                        <span className="text-[#0a0a0a]">
                          {h.fromStage === 'new' ? 'Lead' : h.fromStage} → {h.toStage === 'new' ? 'Lead' : h.toStage}
                        </span>
                        <span className="text-muted">{new Date(h.changedAt).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </SectionBox>

              {/* === CRM EVENT HISTORY === */}
              <SectionBox title="CRM Event History">
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="text-xs text-muted">No CRM events yet. Changing to ConversionLead or Purchase creates an event.</p>
                  ) : (
                    events.map((ev: any) => (
                      <div key={ev._id} className="text-xs bg-[#fafafa] rounded-lg p-2 border border-card-border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#0a0a0a]">{ev.eventName}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusDot(ev.status) }} />
                            {ev.status}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1 text-muted">
                          <span>Stage: {ev.stage}</span>
                          <span>{new Date(ev.createdAt).toLocaleString()}</span>
                        </div>
                        {ev.attempts > 0 && <p className="text-muted mt-0.5">Attempts: {ev.attempts}</p>}
                        {ev.error && <p className="text-red-500 mt-0.5">Error: {ev.error}</p>}
                      </div>
                    ))
                  )}
                </div>
              </SectionBox>
            </div>
          )}
        </div>
      </div>
    </>
  )
}