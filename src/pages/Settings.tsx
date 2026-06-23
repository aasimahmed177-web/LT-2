import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Funnel configuration and CRM event mapping</p>
      </div>

      {/* ═══ Status panel (dark) ═══ */}
      <div className="dark-panel mb-6">
        <div className="px-6 py-5 relative z-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="pill-sm bg-white/10 text-white/70 border border-white/10">Phase 1</span>
              <span className="text-xs text-white/50">Convex CRM events only</span>
            </div>
            <span className="pill-sm bg-amber/20 text-amber border border-amber/20">Meta sending disabled</span>
          </div>
          <div className="flex items-center gap-5 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber" />
              <span className="text-sm text-white font-medium">{pendingCount} pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green" />
              <span className="text-sm text-white/70">{sentCount} sent</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red" />
              <span className="text-sm text-white/70">{failedCount} failed</span>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3 leading-relaxed">
            Stage changes create pending CRM events in Convex. These will be sent to Meta in a later phase.
          </p>
        </div>
      </div>

      {/* ═══ Funnel Mapping ═══ */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-foreground mb-0.5">Funnel Mapping</h2>
        <p className="text-xs text-ink-secondary mb-6">How CRM stages map to Meta Conversion Leads events</p>

        <div className="space-y-8">
          {/* 1. Stored for visibility */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <h3 className="text-xs font-bold text-ink">Stored for visibility</h3>
              <span className="text-[10px] text-ink-muted">Sent for funnel visibility</span>
            </div>
            <div className="flex items-center gap-3">
              {[
                { key: 'Lead', desc: 'Instant Form submitted / new lead received', eventName: 'Lead', color: 'bg-slate-100 text-slate-700' },
                { key: 'Contact', desc: 'Phone picked up, regardless of quality', eventName: 'Contact', color: 'bg-blue-100 text-blue-700' },
              ].map((s, i) => (
                <div key={s.key} className="flex items-center gap-0">
                  <div className="border border-border rounded-lg p-3.5 bg-surface-subtle min-w-[180px]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`pill-sm ${s.color}`}>{s.key}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                      <span className="text-[10px] text-ink-muted font-mono">{s.eventName}</span>
                    </div>
                    <p className="text-[11px] text-ink-secondary">{s.desc}</p>
                  </div>
                  {i < 1 && (
                    <div className="flex items-center text-ink-faint mx-1">
                      <svg width="24" height="12" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="2" y1="6" x2="20" y2="6" />
                        <polyline points="16 2 20 6 16 10" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Optimization candidates */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green" />
              <h3 className="text-xs font-bold text-ink">Optimization candidates</h3>
              <span className="text-[10px] text-ink-muted">Trigger optimization signals to Meta</span>
            </div>
            <div className="flex items-center gap-3">
              {[
                { key: 'Prospect', desc: 'Interested after call, video call scheduled', eventName: 'Prospect', color: 'bg-purple-100 text-purple-700' },
                { key: 'ConversionLead', desc: 'Qualified opportunity with budget/timeline', eventName: 'ConversionLead', color: 'bg-amber-100 text-amber-700' },
                { key: 'Purchase', desc: 'EOI/token/payment/booking/closed deal', eventName: 'Purchase', color: 'bg-green-bg text-green' },
              ].map((s, i) => (
                <div key={s.key} className="flex items-center gap-0">
                  <div className="border border-border rounded-lg p-3.5 bg-surface-subtle min-w-[180px]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`pill-sm ${s.color}`}>{s.key === 'ConversionLead' ? 'Conv. Lead' : s.key}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                      <span className="text-[10px] text-ink-muted font-mono">{s.eventName}</span>
                    </div>
                    <p className="text-[11px] text-ink-secondary">{s.desc}</p>
                  </div>
                  {i < 2 && (
                    <div className="flex items-center text-ink-faint mx-1">
                      <svg width="24" height="12" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="2" y1="6" x2="20" y2="6" />
                        <polyline points="16 2 20 6 16 10" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Disqualified / not used */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange" />
              <h3 className="text-xs font-bold text-ink">Disqualified stages</h3>
              <span className="text-[10px] text-ink-muted">Not used for optimization</span>
            </div>
            <div className="flex items-center gap-3">
              {[
                { key: 'NotQualified', desc: 'Low budget / irrelevant', color: 'bg-orange-100 text-orange-700' },
                { key: 'NoResponse', desc: 'Repeated follow-up failed', color: 'bg-red-100 text-red-700' },
                { key: 'Duplicate', desc: 'Duplicate lead entry', color: 'bg-pink-100 text-pink-700' },
                { key: 'Invalid', desc: 'Wrong number / spam', color: 'bg-gray-100 text-gray-500' },
              ].map((s) => (
                <div key={s.key} className="border border-border rounded-lg p-3.5 bg-surface-subtle flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`pill-sm ${s.color}`}>{s.key === 'NotQualified' ? 'Not Qual.' : s.key}</span>
                    <span className="text-[10px] text-ink-muted font-mono">&rarr; CustomEvent</span>
                  </div>
                  <p className="text-[11px] text-ink-secondary">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Recommended Optimization Target ═══ */}
      <div className="card p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
        <div className="relative z-1">
          <h2 className="text-sm font-bold text-foreground mb-0.5">Recommended Optimization Target</h2>
          <p className="text-xs text-ink-secondary mb-4">Meta ad delivery optimization</p>
          <div className="p-4 rounded-lg bg-blue-bg border border-blue/10">
            <p className="text-sm font-semibold text-foreground mb-1">Prospect + Conversion Lead</p>
            <p className="text-xs text-ink-secondary leading-relaxed">
              These stages represent genuine buying intent. Optimize toward these to improve lead quality and reduce CPA over time.
              Lead and Contact are still sent to Meta for funnel visibility, but they are not optimization targets because they do not signify lead quality.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Stage Definitions ═══ */}
      <div className="card p-6">
        <h2 className="text-sm font-bold text-foreground mb-4">Stage Definitions</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-subtle">
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Stage</th>
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Type</th>
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Definition</th>
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Future Meta Signal</th>
                <th className="text-center text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Use for Optimization</th>
              </tr>
            </thead>
            <tbody>
              {[
                { stage: 'Lead', type: 'Other', desc: 'Instant Form submitted / new lead received.', signal: 'Lead', optimize: false },
                { stage: 'Contact', type: 'Other', desc: 'Phone picked up, regardless of quality.', signal: 'Contact', optimize: false },
                { stage: 'Prospect', type: 'Positive', desc: 'Interested after call, video call scheduled.', signal: 'Prospect', optimize: true },
                { stage: 'Conversion Lead', type: 'Positive', desc: 'Qualified opportunity: real budget/timeline/intent.', signal: 'ConversionLead', optimize: true },
                { stage: 'Purchase', type: 'Positive', desc: 'EOI/token/payment/booking/closed deal.', signal: 'Purchase', optimize: true },
                { stage: 'Not Qualified', type: 'Disqualified', desc: 'Not eligible / low budget / irrelevant.', signal: 'CustomEvent', optimize: false },
                { stage: 'No Response', type: 'Disqualified', desc: 'Repeated follow-up failed.', signal: 'CustomEvent', optimize: false },
                { stage: 'Duplicate', type: 'Disqualified', desc: 'Duplicate lead.', signal: 'CustomEvent', optimize: false },
                { stage: 'Invalid', type: 'Disqualified', desc: 'Wrong number / spam.', signal: 'CustomEvent', optimize: false },
              ].map((s, i) => (
                <tr key={s.stage} className={i < 8 ? 'border-b border-border-subtle' : ''}>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold text-ink">{s.stage}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`pill-sm ${
                      s.type === 'Positive' ? 'bg-green-bg text-green' :
                      s.type === 'Disqualified' ? 'bg-orange-bg text-orange' :
                      'bg-gray-100 text-gray-500'
                    }`}>{s.type}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-xs text-ink-secondary max-w-xs">{s.desc}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono text-ink-muted">{s.signal}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {s.optimize ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8BC269" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}