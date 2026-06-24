import { useState, useEffect, useCallback } from 'react'
import {
  getLead, updateLeadStage, getLeadHistory,
  getLeadNotes, addLeadNote, getLeadTasks, addLeadTask, toggleLeadTask,
  getLeadEvents,
} from './api'

const STAGES = [
  { key: 'Lead', label: 'Lead', color: 'bg-indigo-500' },
  { key: 'Contact', label: 'Contact', color: 'bg-amber-500' },
  { key: 'Prospect', label: 'Prospect', color: 'bg-blue-500' },
  { key: 'ConversionLead', label: 'Conversion Lead', color: 'bg-purple-500' },
  { key: 'Purchase', label: 'Purchase', color: 'bg-emerald-500' },
  { key: 'NotQualified', label: 'Not Qualified', color: 'bg-red-500' },
  { key: 'NoResponse', label: 'No Response', color: 'bg-gray-400' },
  { key: 'Duplicate', label: 'Duplicate', color: 'bg-orange-500' },
  { key: 'Invalid', label: 'Invalid', color: 'bg-red-600' },
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

function SectionBox({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border-l-4 ${accent} bg-gray-50/60 p-3`}>
      <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wider">{title}</p>
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

  const stageColors: Record<string, string> = {
    Lead: 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200/50',
    Contact: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/50',
    contacted: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/50',
    Prospect: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200/50',
    prospect: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200/50',
    ConversionLead: 'bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200/50',
    Purchase: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200/50',
    NotQualified: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200/50',
    NoResponse: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200/50',
    Duplicate: 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200/50',
    Invalid: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200/50',
  }

  const statusBadge = (status: string) => {
    const m: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      sent: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-red-100 text-red-700',
    }
    return m[status] || 'bg-gray-100 text-gray-600'
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{lead?.name || 'Unnamed Lead'}</h2>
                {isTestLead && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    Meta Test Lead
                  </span>
                )}
              </div>
              {lead?.metaLeadId && (
                <p className="text-xs text-muted font-mono mt-0.5">Meta ID: {lead.metaLeadId}</p>
              )}
              {lead?._id && (
                <p className="text-[10px] text-gray-300 font-mono mt-0.5">DB ID: {lead._id}</p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          {loading ? (
            <div className="text-sm text-muted py-12 text-center">Loading lead details...</div>
          ) : loadError ? (
            <div className="text-sm text-red-500 py-12 text-center">
              <p>Failed to load lead</p>
              <p className="text-xs text-gray-400 mt-2">Requested ID: {leadId}</p>
              <p className="text-xs text-gray-400 mt-1">Error: {loadError}</p>
            </div>
          ) : !lead ? (
            <div className="text-sm text-red-500 py-12 text-center">
              <p>Lead not found</p>
              <p className="text-xs text-gray-400 mt-2">ID: {leadId}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* === CRM STATUS === */}
              <SectionBox title="CRM Status" accent="border-indigo-400">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Current Stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => handleStageChange(s.key)}
                        disabled={updatingStage || s.key === lead.stage}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                          s.key === lead.stage
                            ? stageColors[s.key] || 'bg-gray-200 text-gray-700'
                            : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-gray-200'
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
              <SectionBox title="Contact" accent="border-amber-400">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-xs">Phone</span>
                    <p className="text-gray-800">{lead.phone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Email</span>
                    <p className="text-gray-800">{lead.email || '—'}</p>
                  </div>
                </div>
              </SectionBox>

              {/* === QUALIFICATION === */}
              <SectionBox title="Qualification" accent="border-blue-400">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-xs">Budget</span>
                    <p className="text-gray-800">{budget || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Purpose</span>
                    <p className="text-gray-800">{purpose || '—'}</p>
                  </div>
                </div>
              </SectionBox>

              {/* === CAMPAIGN SOURCE === */}
              <SectionBox title="Campaign Source" accent="border-cyan-400">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-xs">Campaign</span>
                    <p className="text-gray-800">{lead.campaignName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Ad</span>
                    <p className="text-gray-800">{lead.adName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Ad Set</span>
                    <p className="text-gray-800">{lead.adSetName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Source</span>
                    <p className="text-gray-800">{lead.platform || 'meta'}</p>
                  </div>
                </div>
              </SectionBox>

              {/* === META / SYSTEM DATA === */}
              <SectionBox title="Meta / System Data" accent="border-gray-400">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted text-xs">Meta Lead ID</span>
                    <p className="text-gray-800 font-mono text-xs">{lead.metaLeadId || '—'}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted text-xs">Meta Page ID</span>
                    <p className="text-gray-800 font-mono text-xs">{lead.pageId || '—'}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted text-xs">Meta Created</span>
                    <p className="text-gray-800 text-xs">{metaCreated ? new Date(metaCreated).toLocaleString() : '—'}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted text-xs">Imported At</span>
                    <p className="text-gray-800 text-xs">{lead.ingestedAt ? new Date(lead.ingestedAt).toLocaleString() : '—'}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-xs font-medium text-accent hover:text-indigo-500"
                  >
                    {showRaw ? 'Hide' : 'Show'} raw field data
                  </button>
                  {showRaw && fieldData.length > 0 && (
                    <div className="mt-2 text-xs bg-white rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto border border-gray-100">
                      {fieldData.map((f: any, i: number) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-medium text-gray-600">{f.name}:</span>
                          <span className="text-gray-800">{(f.values || []).join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionBox>

              {/* === NOTES === */}
              <SectionBox title="Notes" accent="border-emerald-400">
                <div className="space-y-2 max-h-36 overflow-y-auto mb-2">
                  {notes.length === 0 && <p className="text-xs text-muted">No notes</p>}
                  {notes.map((n: any) => (
                    <div key={n._id} className="text-xs bg-white rounded-lg p-2.5 border border-gray-100">
                      <p className="text-gray-700">{n.content}</p>
                      <p className="text-gray-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add a note..."
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button onClick={handleAddNote} className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-indigo-500">Add</button>
                </div>
              </SectionBox>

              {/* === TASKS === */}
              <SectionBox title="Tasks" accent="border-emerald-400">
                <div className="space-y-1.5 max-h-36 overflow-y-auto mb-2">
                  {tasks.length === 0 && <p className="text-xs text-muted">No tasks</p>}
                  {tasks.map((t: any) => (
                    <div key={t._id} className="flex items-center gap-2 text-sm bg-white rounded-lg p-2 border border-gray-100">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => handleToggleTask(t._id, !t.done)}
                        className="rounded border-gray-300 accent-accent"
                      />
                      <span className={t.done ? 'line-through text-muted' : 'text-gray-700'}>{t.content}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="Add a task..."
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button onClick={handleAddTask} className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-indigo-500">Add</button>
                </div>
              </SectionBox>

              {/* === STAGE HISTORY === */}
              <SectionBox title="Stage History" accent="border-purple-400">
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted">No stage changes yet</p>
                  ) : (
                    history.map((h: any) => (
                      <div key={h._id} className="text-xs bg-white rounded-lg p-2 flex justify-between border border-gray-100">
                        <span className="text-gray-700">
                          {h.fromStage === 'new' ? 'Lead' : h.fromStage} → {h.toStage === 'new' ? 'Lead' : h.toStage}
                        </span>
                        <span className="text-gray-400">{new Date(h.changedAt).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </SectionBox>

              {/* === CRM EVENT HISTORY === */}
              <SectionBox title="CRM Event History" accent="border-rose-400">
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="text-xs text-muted">No CRM events yet. Changing to ConversionLead or Purchase creates an event.</p>
                  ) : (
                    events.map((ev: any) => (
                      <div key={ev._id} className="text-xs bg-white rounded-lg p-2 border border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">{ev.eventName}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusBadge(ev.status)}`}>
                            {ev.status}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1 text-gray-400">
                          <span>Stage: {ev.stage}</span>
                          <span>{new Date(ev.createdAt).toLocaleString()}</span>
                        </div>
                        {ev.attempts > 0 && <p className="text-gray-400 mt-0.5">Attempts: {ev.attempts}</p>}
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