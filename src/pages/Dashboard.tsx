import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

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

const STAGE_DOT_COLORS: Record<string, string> = {
  Lead: 'bg-slate-400',
  Contact: 'bg-blue',
  Prospect: 'bg-purple',
  ConversionLead: 'bg-amber',
  Purchase: 'bg-green',
  NotQualified: 'bg-orange',
  NoResponse: 'bg-red',
  Duplicate: 'bg-pink',
  Invalid: 'bg-gray-400',
};

function MiniWidget({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="widget-card">
      <p className="widget-card-label">{label}</p>
      <p className="text-lg font-bold text-foreground tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="kpi-compact">
      <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold text-foreground tracking-tight mt-1">{value}</p>
      {sub && <p className="text-[10px] text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-border rounded-lg px-3 py-2 text-xs shadow-md">
        <p className="text-ink-muted font-medium mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const stats = useQuery(api.leads.getDashboardStats);
  const leads = useQuery(api.leads.listLeads, {});

  if (!stats || !leads) {
    return (
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Lead performance &amp; CRM signals</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4 mb-8 skeleton-fade-in">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-5 animate-pulse">
              <div className="h-3 w-20 bg-surface-container-high rounded mb-3" />
              <div className="h-7 w-16 bg-surface-container-high rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8 skeleton-fade-in">
          <div className="col-span-2 bg-white border border-border rounded-xl p-5 animate-pulse">
            <div className="h-3 w-40 bg-surface-container-high rounded mb-6" />
            <div className="h-[240px] bg-surface-container-low rounded-lg" />
          </div>
          <div className="bg-white border border-border rounded-xl p-5 animate-pulse">
            <div className="h-3 w-32 bg-surface-container-high rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-20 bg-surface-container-high rounded mb-1" />
                  <div className="h-1.5 w-full bg-surface-container-high rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyData = dayNames.map((day, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const dayLeads = leads.filter(l => {
      const t = l.createdAt || 0;
      return t >= dayStart && t < dayEnd;
    });
    return {
      day,
      leads: dayLeads.length,
      qualified: dayLeads.filter(l => l.currentStage === 'ConversionLead' || l.currentStage === 'Purchase').length,
    };
  });

  const stageData = Object.entries(stats.stageCounts || {}).map(([stage, count]) => ({ stage, count: count as number }));
  const maxCount = Math.max(...stageData.map(s => s.count), 1);
  const recentLeads = [...leads].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);

  const pipelineStages = ['Lead', 'Contact', 'Prospect', 'ConversionLead', 'Purchase'];

  return (
    <div className="max-w-full fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Lead performance and CRM signals</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill-sm bg-surface-container-low text-ink-muted">Demo workspace</span>
          <span className="pill-sm bg-surface-container-low text-ink-muted">Phase 1 · CRM events only</span>
        </div>
      </div>

      {/* ═══ Hero dark panel ═══ */}
      <div className="dark-panel mb-7">
        <div className="curve-art" />
        <div className="curve-art-2" />
        <div className="relative z-1 px-7 py-7">
          <div className="flex justify-between items-start gap-8">
            {/* Left copy */}
            <div className="max-w-xs shrink-0">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-[0.08em] mb-1">LeadTrace workspace</p>
              <p className="text-lg font-bold text-white leading-tight tracking-tight">CRM signals from Meta lead qualification</p>
              <p className="text-xs text-white/50 mt-2 leading-relaxed">
                Phase 1: Convex CRM events only. Stage changes create pending CRM events that will be sent to Meta in a later phase.
              </p>
            </div>
            {/* Right: floating widget grid */}
            <div className="grid grid-cols-2 gap-3 min-w-[320px]">
              <MiniWidget label="Total Leads" value={stats.totalLeads} sub="All time" />
              <MiniWidget label="Contacted" value={stats.contacted} sub={`${stats.totalLeads > 0 ? ((stats.contacted / stats.totalLeads) * 100).toFixed(0) : 0}% rate`} />
              <MiniWidget label="Prospects" value={stats.prospect} sub={`${stats.totalLeads > 0 ? ((stats.prospect / stats.totalLeads) * 100).toFixed(0) : 0}% rate`} />
              <MiniWidget label="Pending CRM" value={stats.pendingEvents} sub={`${stats.failedEvents} failed`} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ KPI strip ═══ */}
      <div className="grid grid-cols-5 gap-3 mb-7">
        <KpiCard label="Total Leads" value={stats.totalLeads} sub="All time" />
        <KpiCard label="Contacted" value={stats.contacted} sub={`${stats.totalLeads > 0 ? ((stats.contacted / stats.totalLeads) * 100).toFixed(0) : 0}% rate`} />
        <KpiCard label="Prospects" value={stats.prospect} sub={`${stats.totalLeads > 0 ? ((stats.prospect / stats.totalLeads) * 100).toFixed(0) : 0}% rate`} />
        <KpiCard label="Converted" value={stats.purchase} sub={`${stats.totalLeads > 0 ? ((stats.purchase / stats.totalLeads) * 100).toFixed(0) : 0}% close rate`} />
        <KpiCard label="Pending CRM" value={stats.pendingEvents} sub={`${stats.failedEvents} failed`} />
      </div>

      {/* ═══ Analytics row ═══ */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {/* Weekly activity chart */}
        <div className="col-span-2 card p-5 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
          <h3 className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-5 relative z-1">Lead activity this week</h3>
          <div className="relative z-1">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2F6FED" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#2F6FED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBECF0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#97A0AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#97A0AF' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F4F5F5' }} />
                <Area type="monotone" dataKey="leads" stroke="#2F6FED" strokeWidth={2} fill="url(#areaGrad)" dot={false} name="New leads" />
                <Area type="monotone" dataKey="qualified" stroke="#8BC269" strokeWidth={1.5} fill="none" dot={false} name="Qualified" strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stage distribution */}
        <div className="card p-5">
          <h3 className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-4">Stage distribution</h3>
          <div className="space-y-3">
            {stageData.map(({ stage, count }) => (
              <div key={stage}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT_COLORS[stage] || 'bg-slate-400'}`} />
                    <span className="text-xs text-ink-secondary font-medium">{stage}</span>
                  </div>
                  <span className="text-xs font-semibold text-ink font-mono">{count}</span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-1">
                  <div
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      backgroundColor: stage === 'Lead' ? '#B0B8C4' : stage === 'Contact' ? '#2F6FED' : stage === 'Prospect' ? '#8B5CF6' : stage === 'ConversionLead' ? '#F5A524' : stage === 'Purchase' ? '#8BC269' : '#F97316'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Lead Pipeline (horizontal flow) ═══ */}
      <div className="card p-5 mb-7">
        <h3 className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-5">Lead pipeline</h3>
        <div className="flex items-center gap-0">
          {pipelineStages.map((stage, i) => {
            const f = (stats.funnel || []).find((x: any) => x.stage === stage);
            const count = f?.count || 0;
            const total = stats.funnel?.[0]?.count || 1;
            const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
            const colors = ['bg-slate-300', 'bg-blue', 'bg-purple', 'bg-amber', 'bg-green'];
            const dotColor = ['bg-slate-400', 'bg-blue', 'bg-purple', 'bg-amber', 'bg-green'];
            return (
              <div key={stage} className="flex-1 flex flex-col items-center">
                {/* Stage widget */}
                <div className="text-center px-3 py-2.5 rounded-lg border border-border-subtle bg-surface-subtle w-full mx-1">
                  <div className={`w-2 h-2 rounded-full ${dotColor[i]} mx-auto mb-1.5`} />
                  <p className="text-[10px] font-semibold text-ink-secondary">{stage === 'ConversionLead' ? 'Conv. Lead' : stage}</p>
                  <p className="text-base font-bold text-foreground tracking-tight mt-0.5">{count}</p>
                  <p className="text-[10px] text-ink-muted">{pct}%</p>
                  <div className={`h-0.5 rounded-full mt-2 ${colors[i]} opacity-60`} />
                </div>
                {/* Connector arrow */}
                {i < pipelineStages.length - 1 && (
                  <div className="flex items-center justify-center py-1 text-ink-faint">
                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="2" y1="6" x2="16" y2="6" />
                      <polyline points="12 2 16 6 12 10" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Recent leads ═══ */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Recent leads</h3>
          <span className="text-[10px] text-ink-muted">{recentLeads.length} latest</span>
        </div>
        <div className="card divide-y divide-border-subtle overflow-hidden">
          {recentLeads.map(lead => (
            <div key={lead._id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-subtle transition-colors duration-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-ink-secondary">
                    {lead.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink leading-tight">{lead.fullName}</p>
                  <p className="text-[10px] text-ink-muted">{lead.formName || lead.campaignName || 'Lead'} &middot; {new Date(lead.createdAt || 0).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${STAGE_PILL_COLORS[lead.currentStage] || 'bg-slate-100 text-slate-700'}`}>{lead.currentStage}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}