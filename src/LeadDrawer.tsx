import { useState, useEffect, useCallback } from 'react'
import {
  getLead, updateLeadStage, getLeadHistory,
  getLeadNotes, addLeadNote, getLeadTasks, addLeadTask, toggleLeadTask,
} from './api'

const STAGES = [
  { key: 'new', label: 'Lead', color: 'bg-indigo-500' },
  { key: 'contacted', label: 'Contact', color: 'bg-amber-500' },
  { key: 'prospect', label: 'Prospect', color: 'bg-blue-500' },
  { key: 'ConversionLead', label: 'Conversion Lead', color: 'bg-purple-500' },
  { key: 'Purchase', label: 'Purchase', color: 'bg-emerald-500' },
  { key: 'NotQualified', label: 'Not Qualified', color: 'bg-red-500' },
  { key: 'NoResponse', label: 'No Response', color: 'bg-gray-400' },
  { key: 'Duplicate', label: 'Duplicate', color: 'bg-orange-500' },
  { key: 'Invalid', label: 'Invalid', color: 'bg-red-600' },
]

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
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [newTask, setNewTask] = useState('')
  const [updatingStage, setUpdatingStage] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const load = useCallback(async () => {
    if (!leadId) return
    setLoading(true)
    try {
      const [l, h, n, t] = await Promise.all([
        getLead(leadId),
        getLeadHistory(leadId),
        getLeadNotes(leadId),
        getLeadTasks(leadId),
      ])
      setLead(l)
      setHistory(h.history || h || [])
      setNotes(n.notes || n || [])
      setTasks(t.tasks || t || [])
    } catch (err) {
      console.error('Drawer load error:', err)
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
  const stageColors: Record<string, string> = {
    new: 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200/50',
    contacted: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/50',
    prospect: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200/50',
    ConversionLead: 'bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200/50',
    Purchase: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200/50',
    NotQualified: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200/50',
    NoResponse: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200/50',
    Duplicate: 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200/50',
    Invalid: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200/50',
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{lead?.name || 'Unnamed Lead'}</h2>
              {lead?.metaLeadId && (
                <p className="text-xs text-muted font-mono mt-0.5">ID: {lead.metaLeadId}</p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          {loading ? (
            <div className="text-sm text-muted py-12 text-center">Loading...</div>
          ) : !lead ? (
            <div className="text-sm text-red-500 py-12 text-center">Failed to load lead</div>
          ) : (
            <div className="space-y-6">
              {/* Stage Buttons */}
              <div>
                <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => handleStageChange(s.key)}
                      disabled={updatingStage || s.key === lead.stage}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                        s.key === lead.stage
                          ? stageColors[s.key] || 'bg-gray-200 text-gray-700'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-gray-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Contact</p>
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
              </div>

              {/* Campaign Info */}
              <div>
                <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Campaign</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-xs">Campaign</span>
                    <p className="text-gray-800">{lead.campaignName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Ad / Ad Set</span>
                    <p className="text-gray-800">{lead.adName || lead.adSetName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Platform</span>
                    <p className="text-gray-800">{lead.platform || 'meta'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Page ID</span>
                    <p className="text-gray-800 font-mono text-xs">{lead.pageId || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Timestamps</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted text-xs">Ingested</span>
                    <p className="text-gray-800">{lead.ingestedAt ? new Date(lead.ingestedAt).toLocaleString() : '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs">Stage Changed</span>
                    <p className="text-gray-800">{lead.stageChangedAt ? new Date(lead.stageChangedAt).toLocaleString() : '—'}</p>
                  </div>
                </div>
              </div>

              {/* Raw Field Data */}
              <div>
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs font-medium text-accent hover:text-indigo-500"
                >
                  {showRaw ? 'Hide' : 'Show'} raw field data
                </button>
                {showRaw && fieldData.length > 0 && (
                  <div className="mt-2 text-xs bg-gray-50 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                    {fieldData.map((f: any, i: number) => (
                      <div key={i} className="flex gap-2">
                        <span className="font-medium text-gray-600">{f.name}:</span>
                        <span className="text-gray-800">{(f.values || []).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Notes</p>
                <div className="space-y-2 max-h-32 overflow-y-auto mb-2">
                  {notes.length === 0 && <p className="text-xs text-muted">No notes</p>}
                  {notes.map((n: any) => (
                    <div key={n._id} className="text-xs bg-gray-50 rounded-lg p-2.5">
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
              </div>

              {/* Tasks */}
              <div>
                <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Tasks</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto mb-2">
                  {tasks.length === 0 && <p className="text-xs text-muted">No tasks</p>}
                  {tasks.map((t: any) => (
                    <div key={t._id} className="flex items-center gap-2 text-sm">
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
              </div>

              {/* Stage History */}
              <div>
                <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Stage History</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {history.length === 0 && <p className="text-xs text-muted">No stage changes yet</p>}
                  {history.map((h: any) => (
                    <div key={h._id} className="text-xs bg-gray-50 rounded-lg p-2 flex justify-between">
                      <span className="text-gray-700">
                        {h.fromStage} → {h.toStage}
                      </span>
                      <span className="text-gray-400">{new Date(h.changedAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}