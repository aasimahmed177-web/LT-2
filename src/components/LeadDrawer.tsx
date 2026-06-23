import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useToast } from './Toast';

interface LeadDrawerProps {
  leadId: Id<"leads">;
  onClose: () => void;
}

const STAGE_PILL_COLORS: Record<string, string> = {
  Lead: 'bg-slate-100 text-slate-700',
  Contact: 'bg-blue-100 text-blue-700',
  Prospect: 'bg-purple-100 text-purple-700',
  ConversionLead: 'bg-amber-100 text-amber-700',
  Purchase: 'bg-green-bg text-green',
  NotQualified: 'bg-orange-100 text-orange-700',
  NoResponse: 'bg-red-100 text-red-700',
  Duplicate: 'bg-pink-100 text-pink-700',
  Invalid: 'bg-gray-100 text-gray-500',
};

function StagePill({ stage }: { stage: string }) {
  return (
    <span className={`pill-sm ${STAGE_PILL_COLORS[stage] || 'bg-slate-100 text-slate-700'}`}>
      {stage === 'ConversionLead' ? 'Conv. Lead' : stage}
    </span>
  );
}

function WidgetCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="widget-card">
      <p className="widget-card-label">{label}</p>
      <div className="widget-card-value">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-bg text-amber border-amber/20',
    sent: 'bg-green-bg text-green border-green/20',
    failed: 'bg-red-bg text-red border-red/20',
    skipped: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`pill border ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse mr-0.5" />}
      {status}
    </span>
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

  if (!lead) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/20" onClick={onClose} />
        <div className="relative w-full max-w-[600px] bg-white border-l border-border shadow-2xl h-full overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-border z-10 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-surface-container-high" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-surface-container-high rounded" />
                  <div className="h-3 w-24 bg-surface-container-high rounded" />
                </div>
              </div>
              <div className="w-7 h-7 bg-surface-container-high rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="p-5 space-y-5 animate-pulse">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-surface-container-high rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  const suggestedStages = ['Contact', 'Prospect', 'ConversionLead', 'Purchase'];
  const disqualifiedStages = ['NotQualified', 'NoResponse'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/15" onClick={onClose} />
      <div
        className="relative w-full max-w-[600px] bg-white border-l border-border shadow-2xl h-full overflow-y-auto animate-slide-right"
        onClick={e => e.stopPropagation()}
      >
        {/* ═══ Header ═══ */}
        <div className="sticky top-0 bg-white border-b border-border z-10 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-ink-secondary">
                {lead.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground truncate">{lead.fullName}</h2>
                <StagePill stage={lead.currentStage} />
              </div>
              <p className="text-[11px] text-ink-muted font-mono truncate">{lead.metaLeadId || 'No Meta Lead ID'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-container-low transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ═══ Record Overview Widgets ═══ */}
          <div>
            <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2.5">Lead record</p>
            <div className="grid grid-cols-2 gap-2.5">
              <WidgetCard label="Phone">{lead.phoneNumber || <span className="text-ink-muted">—</span>}</WidgetCard>
              <WidgetCard label="Email">{lead.email || <span className="text-ink-muted">—</span>}</WidgetCard>
              <WidgetCard label="Budget">{answers?.['What budget range are you considering?'] || answers?.Budget || <span className="text-ink-muted">—</span>}</WidgetCard>
              <WidgetCard label="Timeline">{answers?.['What is your preferred timeline?'] || answers?.Timeline || <span className="text-ink-muted">—</span>}</WidgetCard>
              <WidgetCard label="Purpose">{answers?.['Why are you exploring Dubai property?'] || answers?.Purpose || <span className="text-ink-muted">—</span>}</WidgetCard>
              <WidgetCard label="Campaign">{lead.campaignName || <span className="text-ink-muted">—</span>}</WidgetCard>
              <WidgetCard label="Ad">{lead.adName || <span className="text-ink-muted">—</span>}</WidgetCard>
              <WidgetCard label="Meta Lead ID">{lead.metaLeadId || <span className="text-ink-muted">—</span>}</WidgetCard>
            </div>
          </div>

          {/* ═══ Stage Actions ═══ */}
          <div className="card-inset p-3.5">
            <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2.5">
              Stage &middot; Current: {lead.currentStage === 'ConversionLead' ? 'Conv. Lead' : lead.currentStage}
            </p>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {suggestedStages.map(stage => (
                  <button
                    key={stage}
                    onClick={() => handleStageChange(stage)}
                    disabled={lead.currentStage === stage}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-border transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed
                      bg-white text-ink hover:bg-surface-container-low hover:border-border-strong
                      disabled:hover:bg-white disabled:hover:border-border"
                  >
                    {stage === 'ConversionLead' ? 'Conv. Lead' : stage}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {disqualifiedStages.map(stage => (
                  <button
                    key={stage}
                    onClick={() => handleStageChange(stage)}
                    disabled={lead.currentStage === stage}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-border transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed
                      text-ink-muted hover:text-ink hover:bg-surface-container-low
                      disabled:hover:text-ink-muted disabled:hover:bg-transparent"
                  >
                    {stage === 'NotQualified' ? 'Not Qualified' : 'No Response'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ Stage History (timeline) ═══ */}
          <div>
            <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2.5">Stage History</p>
            <div className="relative">
              {!stageHistory || stageHistory.length === 0 ? (
                <p className="text-xs text-ink-muted py-2">No stage changes yet</p>
              ) : (
                <div className="space-y-0">
                  {stageHistory.slice(0, 10).map((h: any, idx: number) => (
                    <div key={h._id} className="flex gap-3 relative pb-3">
                      {/* Timeline line */}
                      {idx < Math.min(stageHistory.length, 10) - 1 && (
                        <div className="absolute left-[7px] top-[18px] bottom-0 w-px bg-border" />
                      )}
                      {/* Dot */}
                      <div className="w-[15px] shrink-0 flex justify-center pt-0.5">
                        <div className="w-[15px] h-[15px] rounded-full border-2 border-border bg-white flex items-center justify-center">
                          <div className="w-[5px] h-[5px] rounded-full bg-ink-muted" />
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {h.fromStage ? (
                            <>
                              <StagePill stage={h.fromStage} />
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted shrink-0"><polyline points="9 18 15 12 9 6" /></svg>
                            </>
                          ) : null}
                          <StagePill stage={h.toStage} />
                        </div>
                        <p className="text-[10px] text-ink-muted mt-0.5">{formatDate(h.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══ CRM Event History ═══ */}
          <div>
            <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2.5">CRM Event History</p>
            <div className="space-y-1.5">
              {!events || events.length === 0 ? (
                <p className="text-xs text-ink-muted py-1">No CRM events recorded yet</p>
              ) : (
                events.map((e: any) => (
                  <div key={e._id} className="widget-card flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">{e.eventName}</span>
                        <StatusPill status={e.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-ink-muted">{formatDate(e.createdAt)}</span>
                        {e.attemptCount > 0 && <span className="text-[10px] text-ink-muted">Attempts: {e.attemptCount}</span>}
                        {e.idempotencyKey && <span className="text-[10px] text-ink-faint font-mono">{e.idempotencyKey}</span>}
                      </div>
                    </div>
                    {e.errorMessage && <p className="text-[10px] text-red mt-1 w-full">{e.errorMessage}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ═══ Notes ═══ */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Notes</p>
              <button onClick={() => setAddingNote(!addingNote)} className="text-[11px] font-semibold text-primary hover:underline">+ Add note</button>
            </div>
            {addingNote && (
              <div className="mb-3 space-y-2">
                <textarea
                  value={noteBody}
                  onChange={e => setNoteBody(e.target.value)}
                  placeholder="Write a note..."
                  className="input resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button onClick={handleAddNote} className="btn btn-primary text-xs px-3 py-1.5">Save</button>
                  <button onClick={() => setAddingNote(false)} className="btn btn-ghost text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}
            <div className="card-inset divide-y divide-border-subtle">
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

          {/* ═══ Tasks ═══ */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Tasks / Follow-up</p>
              <button onClick={() => setAddingTask(!addingTask)} className="text-[11px] font-semibold text-primary hover:underline">+ Add task</button>
            </div>
            {addingTask && (
              <div className="mb-3 space-y-2">
                <input
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  className="input"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddTask} className="btn btn-primary text-xs px-3 py-1.5">Save</button>
                  <button onClick={() => setAddingTask(false)} className="btn btn-ghost text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}
            <div className="card-inset divide-y divide-border-subtle">
              {!tasks || tasks.length === 0 ? (
                <p className="text-xs text-ink-muted px-3 py-3">No tasks yet</p>
              ) : (
                tasks.map((t: any) => (
                  <div key={t._id} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${t.status === 'done' ? 'line-through text-ink-muted' : 'text-ink'}`}>{t.title}</p>
                      {t.dueAt && <span className="text-[10px] text-ink-muted">Due: {formatDate(t.dueAt)}</span>}
                    </div>
                    <StatusPill status={t.status === 'done' ? 'sent' : 'pending'} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ═══ Raw Payload ═══ */}
          {rawPayload && (
            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Raw Payload</p>
              <pre className="text-[10px] text-ink-secondary bg-surface-subtle rounded-lg px-3 py-3 overflow-x-auto font-mono leading-relaxed border border-border-subtle">
                {JSON.stringify(rawPayload, null, 2)}
              </pre>
            </div>
          )}

          {/* ═══ Timestamps ═══ */}
          <div className="pt-3 border-t border-border text-[10px] text-ink-muted space-y-0.5">
            <p>Created: {formatDate(lead.createdAt)}</p>
            <p>Updated: {formatDate(lead.updatedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}