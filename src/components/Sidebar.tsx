import { NavLink } from 'react-router-dom';

const ICONS: Record<string, React.ReactNode> = {
  Dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  Leads: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Events: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
};

function Icon({ name }: { name: string }) {
  return <span className="shrink-0 text-ink-secondary">{ICONS[name]}</span>;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'Dashboard' },
  { to: '/leads', label: 'Leads', icon: 'Leads' },
  { to: '/events', label: 'CRM Events', icon: 'Events' },
  { to: '/settings', label: 'Settings', icon: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 h-screen fixed left-0 top-0 bg-surface-background border-r border-border flex flex-col z-40">
      {/* Brand */}
      <div className="px-4 pt-5 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">LT</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-ink leading-none tracking-tight">LeadTrace</h1>
            <p className="text-[9px] font-semibold text-ink-muted tracking-[0.12em] mt-0.5">META CRM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-md transition-all duration-150 ${
                isActive
                  ? 'text-foreground bg-surface-container-low font-semibold'
                  : 'text-ink-secondary hover:bg-surface-container-low hover:text-foreground'
              }`
            }
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Connection status */}
      <div className="px-4 py-3.5 border-t border-border mt-auto">
        <div className="flex items-center gap-2.5">
          <div className="relative w-2 h-2 shrink-0">
            <span className="absolute inset-0 rounded-full bg-green animate-pulse-subtle" />
            <span className="absolute inset-0 rounded-full bg-green ring-1 ring-green-bg" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-ink leading-tight">Convex Connected</p>
            <p className="text-[10px] text-ink-muted leading-tight">Demo data loaded</p>
          </div>
        </div>
      </div>
    </aside>
  );
}