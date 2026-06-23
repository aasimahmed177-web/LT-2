import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// ─── Settings Page (Phase 1: Vite + Convex only, no Express) ───

export default function Settings() {
  const pendingEvents = useQuery(api.events.listEvents as any, {});

  const pendingCount = pendingEvents
    ? pendingEvents.filter((e: any) => e.status === 'pending').length
    : 0;
  const sentCount = pendingEvents
    ? pendingEvents.filter((e: any) => e.status === 'sent').length
    : 0;
  const failedCount = pendingEvents
    ? pendingEvents.filter((e: any) => e.status === 'failed').length
    : 0;

  return (
    <div className="max-w-4xl fade-in">
      <div className="page-header mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Funnel configuration &amp; stage mapping</p>
      </div>

      {/* ═══ Conversion Events ═══ */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">Conversion Events</h2>
            <p className="text-xs text-ink-secondary">Stage change events recorded in Convex</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm text-ink font-medium">{pendingCount} pending</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-ink-muted">{sentCount} sent</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm text-ink-muted">{failedCount} failed</span>
          </div>
        </div>

        <p className="text-xs text-ink-muted mt-4 leading-relaxed">
          Stage changes create pending CRM events in Convex. These will be sent to Meta in a later phase.
        </p>
      </div>

      {/* ═══ Funnel Mapping ═══ */}
      <div className="card p-6 mb-6">
        <h2 className="text-base font-bold text-ink mb-1">Funnel Mapping</h2>
        <p className="text-xs text-ink-secondary mb-6">How CRM stages map to Meta Conversion Leads events</p>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h3 className="text-sm font-bold text-ink">Other Stages</h3>
              <span className="text-[10px] text-ink-muted">Sent for funnel visibility</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'Lead', desc: 'Instant Form submitted / new lead received', eventName: 'Lead', color: 'bg-slate-100 text-slate-700' },
                { key: 'Contact', desc: 'Phone picked up, regardless of quality', eventName: 'Contact', color: 'bg-blue-100 text-blue-700' },
              ].map(s => (
                <div key={s.key} className="border border-border rounded-xl p-4 bg-surface-container-low">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${s.color}`}>{s.key}</span>
                    <span className="text-[10px] text-ink-muted font-mono">&rarr; {s.eventName}</span>
                  </div>
                  <p className="text-xs text-ink-secondary">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-bold text-ink">Positive Stages</h3>
              <span className="text-[10px] text-ink-muted">Trigger optimization signals to Meta</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'Prospect', desc: 'Interested after call, video call scheduled', eventName: 'Prospect', color: 'bg-purple-100 text-purple-700' },
                { key: 'ConversionLead', desc: 'Qualified opportunity with budget/timeline', eventName: 'ConversionLead', color: 'bg-amber-100 text-amber-700' },
                { key: 'Purchase', desc: 'EOI/token/payment/booking/closed deal', eventName: 'Purchase', color: 'bg-emerald-100 text-emerald-700' },
              ].map(s => (
                <div key={s.key} className="border border-border rounded-xl p-4 bg-surface-container-low">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${s.color}`}>{s.key}</span>
                    <span className="text-[10px] text-ink-muted font-mono">&rarr; {s.eventName}</span>
                  </div>
                  <p className="text-xs text-ink-secondary">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
              <h3 className="text-sm font-bold text-ink">Disqualified Stages</h3>
              <span className="text-[10px] text-ink-muted">Not used for optimization</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { key: 'NotQualified', desc: 'Low budget / irrelevant', color: 'bg-orange-100 text-orange-700' },
                { key: 'NoResponse', desc: 'Repeated follow-up failed', color: 'bg-red-100 text-red-700' },
                { key: 'Duplicate', desc: 'Duplicate lead entry', color: 'bg-pink-100 text-pink-700' },
                { key: 'Invalid', desc: 'Wrong number / spam', color: 'bg-gray-100 text-gray-500' },
              ].map(s => (
                <div key={s.key} className="border border-border rounded-xl p-4 bg-surface-container-low">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${s.color}`}>{s.key}</span>
                    <span className="text-[10px] text-ink-muted">&rarr; CustomEvent</span>
                  </div>
                  <p className="text-xs text-ink-secondary">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Optimization Target ═══ */}
      <div className="card p-6 mb-6">
        <h2 className="text-base font-bold text-ink mb-1">Recommended Optimization Target</h2>
        <p className="text-xs text-ink-secondary mb-4">Meta ad delivery optimization</p>
        <div className="p-4 rounded-xl bg-primary-fixed border border-primary/20">
          <p className="text-sm font-semibold text-ink mb-1">Prospect + ConversionLead</p>
          <p className="text-xs text-ink-secondary leading-relaxed">
            These stages represent genuine buying intent. Optimize toward these to improve lead quality and reduce CPA over time.
            Lead and Contact are still sent to Meta for funnel visibility, but they are not optimization targets because they do not signify lead quality.
          </p>
        </div>
      </div>

      {/* ═══ Stage Definitions ═══ */}
      <div className="card p-6">
        <h2 className="text-base font-bold text-ink mb-4">Stage Definitions</h2>
        <div className="space-y-3">
          {[
            { stage: 'Lead', desc: 'Instant Form submitted / new lead received.' },
            { stage: 'Contact', desc: 'Phone picked up, regardless of quality.' },
            { stage: 'Prospect', desc: 'Interested after call, video call scheduled, or serious next step agreed.' },
            { stage: 'Conversion Lead', desc: 'Qualified opportunity: real budget/timeline/intent and worth senior sales follow-up.' },
            { stage: 'Purchase', desc: 'EOI/token/payment/booking/closed deal.' },
            { stage: 'Not Qualified', desc: 'Not eligible / low budget / irrelevant.' },
            { stage: 'No Response', desc: 'Repeated follow-up failed.' },
            { stage: 'Duplicate', desc: 'Duplicate lead.' },
            { stage: 'Invalid', desc: 'Wrong number / spam.' },
          ].map(s => (
            <div key={s.stage} className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low">
              <span className="text-xs font-bold text-ink shrink-0 w-28">{s.stage}</span>
              <p className="text-xs text-ink-secondary">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}