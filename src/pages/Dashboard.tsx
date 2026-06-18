import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mockStats, weeklyData, mockLeads, getStatusColor, formatDate } from '../data/mockData';

const statuses = ['new', 'contacted', 'pre-qualified', 'qualified', 'converted', 'not-qualified', 'junk'] as const;

function StatCard({ label, value, trend, index = 0 }: { label: string; value: string | number; trend?: string; index?: number }) {
  return (
    <div
      className={`card p-5 fade-in stagger-${index + 1}`}
    >
      <p className="stat-label">{label}</p>
      <p className="stat-value mt-2">{value}</p>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <p className="text-xs text-ink-muted">{trend}</p>
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
    return (
      <div className="bg-surface-background border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
        <p className="text-ink-muted font-medium mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }}></span>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

function RecentLeads() {
  const recent = mockLeads.slice(0, 6);
  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-ink-secondary">Recent leads</h3>
        <span className="text-xs text-ink-muted">{recent.length} latest</span>
      </div>
      <div className="card overflow-hidden divide-y divide-border">
        {recent.map((lead) => (
          <div key={lead.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-container-low transition-colors duration-150">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-fixed to-primary-fixed-dim flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">
                  {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{lead.name}</p>
                <p className="text-xs text-ink-muted">{lead.source} &middot; {formatDate(lead.createdAt)}</p>
              </div>
            </div>
            <span className={`badge ${getStatusColor(lead.status)}`}>{lead.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const statusCounts = statuses.map(s => ({
    status: s,
    count: mockLeads.filter(l => l.status === s).length,
  }));
  const maxCount = Math.max(...statusCounts.map(s => s.count), 1);

  return (
    <div className="max-w-6xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Lead performance &amp; Meta signals</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export
          </button>
          <button className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add lead
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total leads" value={mockStats.totalLeads} trend="+12 this month" index={0} />
        <StatCard label="New today" value={mockStats.newToday} trend="Last 24 hours" index={1} />
        <StatCard label="Qualified" value={mockStats.qualified} index={2} />
        <StatCard label="Converted" value={mockStats.converted} trend={`${mockStats.conversionRate}% rate`} index={3} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4 mb-8 fade-in">
        <div className="col-span-2 card p-5">
          <h3 className="text-xs font-semibold text-ink-secondary mb-6">Lead activity this week</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f4f4f5' }} />
              <Bar dataKey="leads" fill="#2563eb" radius={[4, 4, 0, 0]} name="Leads" />
              <Bar dataKey="qualified" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Qualified" />
              <Bar dataKey="converted" fill="#93c5fd" radius={[4, 4, 0, 0]} name="Converted" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status distribution */}
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-ink-secondary mb-6">Status distribution</h3>
          <div className="space-y-3">
            {statusCounts.map(({ status, count }) => (
              <div key={status}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-ink-secondary font-medium capitalize">{status}</span>
                  <span className="text-xs font-mono text-ink-muted">{count}</span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      status === 'new' ? 'bg-primary' :
                      status === 'contacted' ? 'bg-secondary' :
                      status === 'qualified' ? 'bg-success' :
                      status === 'converted' ? 'bg-primary-container' :
                      status === 'pre-qualified' ? 'bg-violet-500' :
                      status === 'not-qualified' ? 'bg-warning' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-secondary">Signal quality</span>
              <span className="text-xs font-semibold text-success">Good</span>
            </div>
            <p className="text-xs text-ink-muted mt-1">Status changes syncing to Meta</p>
          </div>
        </div>
      </div>

      {/* Recent leads */}
      <RecentLeads />
    </div>
  );
}