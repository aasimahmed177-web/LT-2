import { NavLink, Outlet } from 'react-router-dom'
import { useClient } from './ClientContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leads', label: 'Leads' },
  { to: '/telecalling', label: 'Telecalling' },
  { to: '/events', label: 'Events' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { clients, currentClientId, setCurrentClientId, currentClient } = useClient()

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-52 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0a0a0a] flex items-center justify-center text-white text-[11px] font-bold tracking-tight transition-transform-expo">
              LT
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-[#0a0a0a] tracking-tight leading-none">LeadTrace</span>
              <span className="text-[9px] text-muted mt-0.5 tracking-wider uppercase">CRM</span>
            </div>
          </div>
        </div>

        {/* Client Selector */}
        <div className="px-3 py-3 border-b border-sidebar-border">
          <p className="text-[9px] uppercase tracking-widest text-muted font-medium mb-1.5 px-2">Workspace</p>
          <select
            value={currentClientId}
            onChange={(e) => setCurrentClientId(e.target.value)}
            className="w-full text-xs border border-card-border rounded-md px-2.5 py-1.5 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {currentClient?.config?.tokenConfigured === false && (
            <p className="text-[9px] text-amber-600 mt-1 px-2 tracking-wide">Not configured</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all-expo relative ${
                  isActive
                    ? 'bg-[#0a0a0a] text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-[18px] before:bg-white/80 before:rounded-r-full'
                    : 'text-muted hover:bg-sidebar-hover hover:text-[#0a0a0a]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Status footer */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0a0a0a] opacity-20" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-[#0a0a0a]" />
            </span>
            <span className="text-[10px] text-muted tracking-wide">Convex cloud</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-white">
        <Outlet />
      </main>
    </div>
  )
}