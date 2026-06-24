import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◉' },
  { to: '/leads', label: 'Leads', icon: '◈' },
  { to: '/events', label: 'Events', icon: '◎' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout() {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold">
              LT
            </div>
            <span className="font-semibold text-[15px] text-gray-800">LeadTrace</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-active text-gray-900'
                    : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-700'
                }`
              }
            >
              <span className="w-4 text-center text-sm opacity-60">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Convex cloud
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  )
}