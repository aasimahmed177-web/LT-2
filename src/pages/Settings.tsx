import { useState } from 'react';
import { mockMetaConnection, mockLeadForms, mockTeamMembers, mockAssignmentRules, formatDate } from '../data/mockData';
import type { MetaConnection } from '../types';

type Tab = 'meta' | 'forms' | 'team' | 'assignment';

const tabs: { key: Tab; label: string }[] = [
  { key: 'meta', label: 'Meta Connection' },
  { key: 'forms', label: 'Lead Forms' },
  { key: 'team', label: 'Team' },
  { key: 'assignment', label: 'Assignment' },
];

function Toggle({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} />
      <div className="w-9 h-5 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all duration-150 peer-checked:bg-primary transition-colors duration-150"></div>
    </label>
  );
}

function MetaConnectionTab() {
  const [conn, setConn] = useState<MetaConnection>(mockMetaConnection);
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-base font-bold text-ink mb-1">Conversions API</h3>
        <p className="text-xs text-ink-secondary mb-5">Connect your Meta Business account to sync leads and optimization signals</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Pixel / Dataset ID</label>
            <input type="text" className="input" value={conn.pixelId} onChange={e => setConn({ ...conn, pixelId: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Access Token</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} className="input pr-16" value={conn.accessToken} onChange={e => setConn({ ...conn, accessToken: e.target.value })} />
              <button onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-secondary hover:text-ink transition-colors">
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Facebook Page ID</label>
            <input type="text" className="input" value={conn.facebookPageId} onChange={e => setConn({ ...conn, facebookPageId: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="relative w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-subtle"></span>
              <span className="absolute inset-0 rounded-full bg-emerald-500 ring-2 ring-emerald-50"></span>
            </span>
            <span className="text-xs font-medium text-ink-secondary">Connected</span>
            {conn.lastSync && <span className="text-xs text-ink-muted">&middot; last sync {formatDate(conn.lastSync)}</span>}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary">Test</button>
            <button className="btn btn-primary">Save</button>
          </div>
        </div>
      </div>

      {/* Signals */}
      <div className="card p-5">
        <h3 className="text-base font-bold text-ink mb-1">Optimization signals</h3>
        <p className="text-xs text-ink-secondary mb-4">Status changes that trigger Meta optimization events</p>
        <div className="space-y-1">
          {[
            { status: 'contacted', desc: 'Team initiated contact' },
            { status: 'pre-qualified', desc: 'Meets preliminary criteria' },
            { status: 'qualified', desc: 'High-intent buyer — strong signal to Meta' },
            { status: 'converted', desc: 'Deal closed — strongest positive signal' },
            { status: 'not-qualified', desc: 'Not a fit — helps Meta refine targeting' },
            { status: 'junk', desc: 'Invalid lead — filters out similar profiles' },
          ].map((s) => (
            <div key={s.status} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-container-low transition-colors duration-150">
              <div>
                <p className="text-sm font-medium text-ink capitalize">{s.status}</p>
                <p className="text-xs text-ink-secondary">{s.desc}</p>
              </div>
              <Toggle defaultChecked />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeadFormsTab() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-base font-bold text-ink">Connected lead forms</h3>
          <p className="text-xs text-ink-secondary mt-1">Meta Instant Forms linked to your account</p>
        </div>
        <button className="btn btn-secondary">Sync forms</button>
      </div>
      <table className="table-leads">
        <thead>
          <tr>
            <th>Form name</th>
            <th>Page</th>
            <th>Status</th>
            <th>Leads</th>
            <th>Last lead</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {mockLeadForms.map(f => (
            <tr key={f.id}>
              <td className="font-semibold text-ink">{f.name}</td>
              <td className="text-ink-secondary">{f.pageName}</td>
              <td>
                <span className={`badge ${f.status === 'active' ? 'bg-success-bg text-success' : 'bg-surface-container-low text-ink-muted'}`}>
                  {f.status}
                </span>
              </td>
              <td className="font-semibold">{f.leadCount}</td>
              <td className="text-xs text-ink-muted">{formatDate(f.lastLeadAt)}</td>
              <td><button className="btn btn-ghost">Configure</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamTab() {
  const [members] = useState(mockTeamMembers);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-base font-bold text-ink">Team members</h3>
          <p className="text-xs text-ink-secondary mt-1">Manage CRM access</p>
        </div>
        <button className="btn btn-primary">Invite</button>
      </div>
      <table className="table-leads">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Leads</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id}>
              <td className="font-semibold text-ink">{m.name}</td>
              <td className="text-ink-secondary">{m.email}</td>
              <td>
                <span className={`badge ${
                  m.role === 'admin' ? 'bg-violet-50 text-violet-700' :
                  m.role === 'manager' ? 'bg-blue-50 text-blue-700' :
                  'bg-surface-container-low text-ink-secondary'
                }`}>{m.role}</span>
              </td>
              <td className="font-semibold">{m.assignedLeads}</td>
              <td>
                <span className={`badge ${m.active ? 'bg-success-bg text-success' : 'bg-error-container text-error'}`}>
                  {m.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td><button className="btn btn-ghost">Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentTab() {
  const [rules] = useState(mockAssignmentRules);
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-ink">Auto-assignment rules</h3>
            <p className="text-xs text-ink-secondary mt-1">Automatically assign new leads to team members</p>
          </div>
          <button className="btn btn-primary">Add rule</button>
        </div>
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between py-3 px-3 rounded-lg bg-surface-container-low mb-2 last:mb-0 hover:bg-surface-container transition-colors duration-150">
            <div>
              <p className="text-sm font-semibold text-ink">{rule.name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-ink-secondary">Source: {rule.source || 'All'}</span>
                <span className="text-xs text-ink-secondary">Max/day: {rule.maxLeadsPerDay}</span>
                <span className="text-xs text-ink-secondary">{rule.roundRobin ? 'Round robin' : 'Fixed'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Toggle defaultChecked={rule.active} />
              <button className="btn btn-ghost">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {/* Flow diagram */}
      <div className="card p-5">
        <h3 className="text-base font-bold text-ink mb-4">Signal &amp; lead flow</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-container-low">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-primary bg-primary-fixed shrink-0 mt-0.5">1</div>
            <div>
              <p className="text-sm font-semibold text-ink">Lead captured via Meta Instant Form</p>
              <p className="text-xs text-ink-secondary mt-1">Data pulled from Meta into CRM in real-time</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-container-low">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-violet-700 bg-violet-50 shrink-0 mt-0.5">2</div>
            <div>
              <p className="text-sm font-semibold text-ink">Team contacts &amp; updates status</p>
              <p className="text-xs text-ink-secondary mt-1">Call or email the lead, update status in CRM</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-container-low">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-success bg-success-bg shrink-0 mt-0.5">3</div>
            <div>
              <p className="text-sm font-semibold text-ink">Status change sent to Meta via CAPI</p>
              <p className="text-xs text-ink-secondary mt-1">Qualified, converted, junk — each update fires a signal</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-container-low">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-primary bg-primary-fixed shrink-0 mt-0.5">4</div>
            <div>
              <p className="text-sm font-semibold text-ink">Meta optimizes ad delivery</p>
              <p className="text-xs text-ink-secondary mt-1">Algorithm learns which profiles convert &rarr; lowers CPA</p>
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-xl bg-surface-muted border border-border">
          <p className="text-xs text-ink-secondary leading-relaxed">
            <strong className="text-ink">How it works:</strong> Mark a lead as <strong className="text-ink">qualified</strong> or <strong className="text-ink">converted</strong> and Meta learns to find more like them.
            Mark as <strong className="text-ink">junk</strong> or <strong className="text-ink">not-qualified</strong> and Meta filters out low-quality traffic. Over time, your CPA drops and lead quality improves.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('meta');

  return (
    <div className="max-w-4xl fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Meta integration &amp; team management</p>
        </div>
      </div>

      <div className="flex border-b border-border mb-6 gap-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab tab-active' : 'tab tab-inactive'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'meta' && <MetaConnectionTab />}
      {activeTab === 'forms' && <LeadFormsTab />}
      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'assignment' && <AssignmentTab />}
    </div>
  );
}