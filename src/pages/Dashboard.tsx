import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STAGE_COLORS: Record<string, string> = {
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

function StatCard({ label, value, sub, loading = false }: { label: string; value: string | number; sub?: string; loading?: boolean }) {
  if (loading) {
    return (
      <div className="bg-white border border-border rounded-xl p-5 animate-pulse">
        <div className="h-3 w-20 bg-surface-container-high rounded mb-3" />
        <div className="h-7 w-16 bg-surface-container-high rounded" />
        {sub && <div className="h-3 w-24 bg-surface-container-high rounded mt-3" />}
      </div>
    );
  }
  return (
    <div className="bg-white border border-border rounded-xl p-5 fade-in hover:shadow-sm transition-shadow duration-200">
      <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-ink tracking-tight mt-2">{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-2">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
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
            <h1 className="text-xl font-bold text-ink tracking-tight">Dashboard</h1>
            <p className="text-xs font-medium text-ink-secondary mt-0.5">Lead performance &amp; signals</p>
          </div>
        </div>
        {/* Skeleton primary stats */}
        <div className="grid grid-cols-5 gap-4 mb-8 skeleton-fade-in">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`bg-white border border-border rounded-xl p-5 animate-pulse stagger-${i + 1}`}>
              <div className="h-3 w-20 bg-surface-container-high rounded mb-3" />
              <div className="h-7 w-16 bg-surface-container-high rounded" />
              <div className="h-3 w-24 bg-surface-container-high rounded mt-3" />
            </div>
          ))}
        </div>
        {/* Skeleton secondary stats */}
        <div className="grid grid-cols-4 gap-4 mb-8 skeleton-fade-in">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`bg-white border border-border rounded-xl p-5 animate-pulse stagger-${i + 1}`}>
              <div className="h-3 w-16 bg-surface-container-high rounded mb-3" />
              <div className="h-7 w-12 bg-surface-container-high rounded" />
              <div className="h-3 w-20 bg-surface-container-high rounded mt-3" />
            </div>
          ))}
        </div>
        {/* Skeleton charts */}
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
                  <div className="flex justify-between mb-1">
                    <div className="h-3 w-20 bg-surface-container-high rounded" />
                    <div className="h-3 w-8 bg-surface-container-high rounded" />
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-high rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Skeleton funnel */}
        <div className="bg-white border border-border rounded-xl p-5 mb-8 animate-pulse skeleton-fade-in">
          <div className="h-3 w-24 bg-surface-container-high rounded mb-5" />
          <div className="flex items-end justify-center gap-3 h-[200px]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="h-3 w-6 bg-surface-container-high rounded" />
                <div className="w-full rounded-t-lg bg-surface-container-high" style={{ height: `${Math.random() * 80 + 60}px` }} />
                <div className="h-3 w-12 bg-surface-container-high rounded" />
              </div>
            ))}
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
      converted: dayLeads.filter(l => l.currentStage === 'Purchase').length,
    };
  });

  const stageData = Object.entries(stats.stageCounts || {}).map(([stage, count]) => ({ stage, count: count as number }));
  const maxCount = Math.max(...stageData.map(s => s.count), 1);
  const recentLeads = [...leads].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);

  return (
    <div className="max-w-6xl fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Dashboard</h1>
          <p className="text-xs font-medium text-ink-secondary mt-0.5">Lead performance &amp; Meta signals</p>
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard label="Total leads" value={stats.totalLeads} sub="All time" />
        <StatCard label="Contacted" value={stats.contacted} sub={`${stats.totalLeads > 0 ? ((stats.contacted / stats.totalLeads) * 100).toFixed(1) : 0}% rate`} />
        <StatCard label="Prospects" value={stats.prospect} sub={`${stats.totalLeads > 0 ? ((stats.prospect / stats.totalLeads) * 100).toFixed(1) : 0}% rate`} />
        <StatCard label="Converted" value={stats.purchase} sub={`${stats.totalLeads > 0 ? ((stats.purchase / stats.totalLeads) * 100).toFixed(1) : 0}% close rate`} />
        <StatCard label="Pending Events" value={stats.pendingEvents} sub={`${stats.failedEvents} failed`} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="New Today" value={stats.newToday} sub="Last 24 hours" />
        <StatCard label="Follow-ups Due" value={stats.followUpsDue} sub="Tasks overdue" />
        <StatCard label="Missing Meta ID" value={stats.missingMetaLeadId} sub="No leadgen_id" />
        <StatCard label="Missing Phone" value={stats.missingPhone} sub="No phone number" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4 mb-8 fade-in">
        <div className="col-span-2 bg-white border border-border rounded-xl p-5">
          <h3 className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider mb-6">Lead activity this week</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f1" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f4f4f5' }} />
              <Bar dataKey="leads" fill="#2563eb" radius={[4, 4, 0, 0]} name="New leads" />
              <Bar dataKey="qualified" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Qualified" />
              <Bar dataKey="converted" fill="#93c5fd" radius={[4, 4, 0, 0]} name="Converted" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider mb-4">Stage distribution</h3>
          <div className="space-y-3">
            {stageData.map(({ stage, count }) => (
              <div key={stage}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-ink-secondary font-medium">{stage}</span>
                  <span className="text-xs font-mono text-ink-muted">{count}</span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: stage === 'Lead' ? '#94a3b8' : stage === 'Contact' ? '#3b82f6' : stage === 'Prospect' ? '#8b5cf6' : stage === 'ConversionLead' ? '#f59e0b' : stage === 'Purchase' ? '#10b981' : '#f97316' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-white border border-border rounded-xl p-5 mb-8 fade-in">
        <h3 className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider mb-5">Lead Funnel</h3>
        <div className="flex items-end justify-center gap-3">
          {(stats.funnel || []).map((f: any, i: number) => {
            const total = stats.funnel?.[0]?.count || 1;
            const pct = total > 0 ? ((f.count / total) * 100).toFixed(0) : '0';
            const maxCount = Math.max(...(stats.funnel || []).map((x: any) => x.count), 1);
            const height = Math.max((f.count / maxCount) * 180, 20);
            const colors = ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];
            return (
              <div key={f.stage} className="flex flex-col items-center gap-2 flex-1">
                <span className="text-xs font-semibold text-ink">{f.count}</span>
                <div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${height}px`, backgroundColor: colors[i], opacity: 0.85 }} />
                <span className="text-[10px] text-ink-muted">{f.stage}</span>
                <span className="text-[10px] font-semibold text-ink-secondary">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent leads */}
      <div className="fade-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-ink-secondary">Recent leads</h3>
          <span className="text-xs text-ink-muted">{recentLeads.length} latest</span>
        </div>
        <div className="bg-white border border-border rounded-xl divide-y divide-border overflow-hidden">
          {recentLeads.map(lead => (
            <div key={lead._id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-container-low transition-colors duration-150">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-fixed to-primary-fixed-dim flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{lead.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink leading-tight">{lead.fullName}</p>
                  <p className="text-xs text-ink-muted truncate max-w-[200px]">{lead.formName || lead.campaignName || 'Lead'} &middot; {new Date(lead.createdAt || 0).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md ${STAGE_COLORS[lead.currentStage] || 'bg-slate-100 text-slate-700'}`}>{lead.currentStage}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}