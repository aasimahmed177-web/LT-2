import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useToast } from './Toast';

interface LeadDrawerProps {
  leadId: Id<"leads">;
  onClose: () => void;
}

const STAGE_ACTIONS = [
  { key: 'Contact', label: 'Mark Contact', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { key: 'Prospect', label: 'Mark Prospect', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { key: 'ConversionLead', label: 'Mark ConversionLead', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { key: 'Purchase', label: 'Mark Purchase', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { key: 'NotQualified', label: 'Mark Not Qualified', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
  { key: 'NoResponse', label: 'Mark No Response', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
];

function StagePill({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    Lead: 'bg-slate-100 text-slate-700',
    Contact: 'bg-blue-100 text-blue-700',
    Prospect: 'bg-purple-100 text-purple-700',
    ConversionLead: 'bg-amber-100 text-amber-700',
    Purchase: 'bg-emerald-100 text-emerald-700',
    NotQualified: 'bg-orange-100 text-orange-700',
    NoResponse: 'bg-red-100 text-red-700',
    Duplicate: 'bg-pink-100 text-pink-700',
    Invalid: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${colors[stage] || 'bg-slate-100 text-slate-700'}`}>
      {stage}
    </span>
  );
}

function SyncBadge({ status }: { status?: string }) {
  if (!status || status === 'not_sent') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">Not sent</span>;
  }
  if (status === 'pending') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Pending</span>;
  }
  if (status === 'sent') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Sent</span>;
  }
  if (status === 'failed') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 text-red-700">Failed</span>;
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-low rounded-lg px-3 py-2.5">
      <p className="text-[10px] font-semibold text-ink-secondary uppercase tracking-wider">{label}</p>
      <div className="text-sm text-ink mt-0.5 break-all">{children}</div>
    </div>
  );
}

export default function LeadDrawer({ leadId, onClose }: LeadDrawerProps) {
  const { addToast } = useToast();
  const lead = useQuery(api.leads.getLead, { leadId });
  const stageHistory = useQuery(api.leads.listStageHistoryForLead as any, { leadId });
  const events = useQuery(api.events.listEventsForLead, { leadId });
  const notes = useQuery(api.notes.listNotesForLead as any, { leadId });
  const tasks = useQuery(api.tasks.listTasksForLead as any, { leadId });
  const updateStage = useMutation(api.leads.updateLeadStage);
  const addNote = useMutation(api.notes.addNote as any);
  const createTask = useMutation(api.tasks.createTask as any);

  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!lead) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/20" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white border-l border-border shadow-2xl h-full overflow-y-auto">
          {/* Skeleton header */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-border z-10 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-surface-container-high" />
                <div>
                  <div className="h-4 w-32 bg-surface-container-high rounded mb-1" />
                  <div className="h-3 w-24 bg-surface-container-high rounded" />
                </div>
              </div>
              <div className="w-7 h-7 bg-surface-container-high rounded-lg animate-pulse" />
            </div>
          </div>
          {/* Skeleton body */}
          <div className="p-5 space-y-5 animate-pulse">
            <div className="flex gap-1.5">
              <div className="h-7 w-20 bg-surface-container-high rounded-lg" />
              <div className="h-7 w-20 bg-surface-container-high rounded-lg" />
              <div className="h-7 w-20 bg-surface-container-high rounded-lg" />
            </div>
            <div>
              <div className="h-3 w-24 bg-surface-container-high rounded mb-2" />
              <div className="flex flex-wrap gap-1.5">
                <div className="h-7 w-24 bg-surface-container-high rounded-lg" />
                <div className="h-7 w-24 bg-surface-container-high rounded-lg" />
                <div className="h-7 w-24 bg-surface-container-high rounded-lg" />
                <div className="h-7 w-24 bg-surface-container-high rounded-lg" />
                <div className="h-7 w-28 bg-surface-container-high rounded-lg" />
                <div className="h-7 w-28 bg-surface-container-high rounded-lg" />
              </div>
            </div>
            <div>
              <div className="h-3 w-28 bg-surface-container-high rounded mb-2" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-14 bg-surface-container-high rounded-lg" />
                <div className="h-14 bg-surface-container-high rounded-lg" />
              </div>
            </div>
            <div>
              <div className="h-3 w-28 bg-surface-container-high rounded mb-2" />
              <div className="h-20 bg-surface-container-high rounded-lg" />
            </div>
            <div>
              <div className="h-3 w-24 bg-surface-container-high rounded mb-2" />
              <div className="h-24 bg-surface-container-high rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStageChange = async (stage: string) => {
    try {
      await updateStage({ leadId, stage });
      addToast('Stage updated. Pending CRM event created.');
    } catch (err) {
      console.error('Failed to update stage:', err);
      addToast('Failed to update stage', 'error');
    }
  };

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    try {
      await addNote({ leadId, body: noteBody.trim(), createdBy: 'User' });
      setNoteBody('');
      setAddingNote(false);
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      await createTask({ leadId, title: taskTitle.trim() });
      setTaskTitle('');
      setAddingTask(false);
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const formatDate = (ts?: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const answers = lead.answers as Record<string, string> | undefined;
  const rawPayload = lead.rawPayload as Record<string, any> | undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white border-l border-border shadow-2xl h-full overflow-y-auto animate-slide-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-border z-10 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-fixed to-primary-fixed-dim flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {lead.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink truncate">{lead.fullName}</h2>
              <p className="text-[11px] text-ink-muted font-mono truncate">{lead.metaLeadId || 'No Meta Lead ID'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StagePill stage={lead.currentStage} />
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-container-low transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => copyToClipboard(lead.phoneNumber || '', 'phone')} className="btn btn-ghost text-xs px-2 py-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              {copiedField === 'phone' ? 'Copied!' : 'Copy phone'}
            </button>
            <button onClick={() => copyToClipboard(lead.metaLeadId || '', 'metaId')} className="btn btn-ghost text-xs px-2 py-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              {copiedField === 'metaId' ? 'Copied!' : 'Copy Lead ID'}
            </button>
            {lead.phoneNumber && (
              <a href={`https://wa.me/${lead.phoneNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs px-2 py-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                WhatsApp
              </a>
            )}
          </div>

          {/* Stage Actions */}
          <div>
            <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Change Stage</h3>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_ACTIONS.map(action => (
                <button
                  key={action.key}
                  onClick={() => handleStageChange(action.key)}
                  disabled={lead.currentStage === action.key}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${action.color}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Contact Information</h3>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone">{lead.phoneNumber || <span className="text-ink-muted">—</span>}</Field>
              <Field label="Email">{lead.email || <span className="text-ink-muted">—</span>}</Field>
            </div>
          </div>

          {/* Meta Information */}
          <div>
            <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Meta Campaign Info</h3>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Meta Lead ID">{lead.metaLeadId || <span className="text-ink-muted">—</span>}</Field>
              <Field label="Form Name">{lead.formName || <span className="text-ink-muted">—</span>}</Field>
              <Field label="Campaign">{lead.campaignName || <span className="text-ink-muted">—</span>}</Field>
              <Field label="Ad Set">{lead.adsetName || <span className="text-ink-muted">—</span>}</Field>
              <Field label="Ad Name">{lead.adName || <span className="text-ink-muted">—</span>}</Field>
              <Field label="Page ID">{lead.pageId || <span className="text-ink-muted">—</span>}</Field>
              <Field label="Form ID">{lead.formId || <span className="text-ink-muted">—</span>}</Field>
              <Field label="Sync Status"><SyncBadge status={lead.syncStatus} /></Field>
            </div>
          </div>

          {/* Form Answers */}
          {answers && Object.keys(answers).length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Form Answers</h3>
              <div className="space-y-1.5">
                {Object.entries(answers).map(([q, a]) => (
                  <div key={q} className="bg-surface-container-low rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-ink-secondary">{q}</p>
                    <p className="text-sm text-ink mt-0.5">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stage History */}
          <div>
            <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Stage History</h3>
            <div className="bg-surface-container-low rounded-lg divide-y divide-border/50">
              {!stageHistory || stageHistory.length === 0 ? (
                <p className="text-xs text-ink-muted px-3 py-3">No stage changes yet</p>
              ) : (
                stageHistory.slice(0, 10).map((h: any) => (
                  <div key={h._id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      {h.fromStage ? (
                        <>
                          <StagePill stage={h.fromStage} />
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted"><polyline points="9 18 15 12 9 6" /></svg>
                        </>
                      ) : null}
                      <StagePill stage={h.toStage} />
                    </div>
                    <span className="text-[10px] text-ink-muted">{formatDate(h.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Event Sync History */}
          <div>
            <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Event Sync History</h3>
            <div className="bg-surface-container-low rounded-lg divide-y divide-border/50">
              {!events || events.length === 0 ? (
                <p className="text-xs text-ink-muted px-3 py-3">No events recorded yet</p>
              ) : (
                events.map((e: any) => (
                  <div key={e._id} className="px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-ink">{e.eventName}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        e.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                        e.status === 'sent' ? 'bg-emerald-50 text-emerald-700' :
                        e.status === 'failed' ? 'bg-red-50 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{e.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-ink-muted">{formatDate(e.createdAt)}</span>
                      {e.attemptCount > 0 && <span className="text-[10px] text-ink-muted">Attempts: {e.attemptCount}</span>}
                    </div>
                    {e.errorMessage && <p className="text-[10px] text-red-600 mt-1">{e.errorMessage}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Notes</h3>
              <button onClick={() => setAddingNote(!addingNote)} className="text-[11px] font-semibold text-primary hover:underline">+ Add note</button>
            </div>
            {addingNote && (
              <div className="mb-3 space-y-2">
                <textarea
                  value={noteBody}
                  onChange={e => setNoteBody(e.target.value)}
                  placeholder="Write a note..."
                  className="w-full text-sm text-ink bg-white border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] transition-all duration-150 resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button onClick={handleAddNote} className="btn btn-primary text-xs px-3 py-1.5">Save</button>
                  <button onClick={() => setAddingNote(false)} className="btn btn-ghost text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}
            <div className="bg-surface-container-low rounded-lg divide-y divide-border/50">
              {!notes || notes.length === 0 ? (
                <p className="text-xs text-ink-muted px-3 py-3">No notes yet</p>
              ) : (
                notes.map((n: any) => (
                  <div key={n._id} className="px-3 py-2.5">
                    <p className="text-sm text-ink leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {n.createdBy && <span className="text-[10px] font-medium text-ink-secondary">{n.createdBy}</span>}
                      <span className="text-[10px] text-ink-muted">{formatDate(n.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Tasks / Follow-up</h3>
              <button onClick={() => setAddingTask(!addingTask)} className="text-[11px] font-semibold text-primary hover:underline">+ Add task</button>
            </div>
            {addingTask && (
              <div className="mb-3 space-y-2">
                <input
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full text-sm text-ink bg-white border border-border rounded-lg px-3 py-1.5 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] transition-all duration-150"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddTask} className="btn btn-primary text-xs px-3 py-1.5">Save</button>
                  <button onClick={() => setAddingTask(false)} className="btn btn-ghost text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}
            <div className="bg-surface-container-low rounded-lg divide-y divide-border/50">
              {!tasks || tasks.length === 0 ? (
                <p className="text-xs text-ink-muted px-3 py-3">No tasks yet</p>
              ) : (
                tasks.map((t: any) => (
                  <div key={t._id} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${t.status === 'done' ? 'line-through text-ink-muted' : 'text-ink'}`}>{t.title}</p>
                      {t.dueAt && <span className="text-[10px] text-ink-muted">Due: {formatDate(t.dueAt)}</span>}
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      t.status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>{t.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Raw Payload */}
          {rawPayload && (
            <div>
              <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Raw Payload</h3>
              <pre className="text-[10px] text-ink-secondary bg-surface-container-low rounded-lg px-3 py-3 overflow-x-auto font-mono leading-relaxed">
                {JSON.stringify(rawPayload, null, 2)}
              </pre>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-3 border-t border-border text-[11px] text-ink-muted space-y-1">
            <p>Created: {formatDate(lead.createdAt)}</p>
            <p>Updated: {formatDate(lead.updatedAt)}</p>
            <div className="flex items-center gap-2 mt-2">
              <SyncBadge status={lead.syncStatus} />
              {lead.lastEventSent && <span className="text-[10px] text-ink-muted">Last event: {lead.lastEventSent}</span>}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes slideRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .animate-slide-right {
            animation: slideRight 0.2s ease;
          }
        `}</style>
      </div>
    </div>
  );
}