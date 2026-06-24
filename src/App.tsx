import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Settings from './pages/Settings'
import Leads from './pages/Leads'

function App() {
  const location = useLocation()

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
      <nav style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #ddd', marginBottom: 24 }}>
        <Link to="/settings" style={{ fontWeight: location.pathname === '/settings' ? 'bold' : 'normal' }}>
          Settings
        </Link>
        <Link to="/leads" style={{ fontWeight: location.pathname === '/leads' ? 'bold' : 'normal' }}>
          Leads
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<Settings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/leads" element={<Leads />} />
      </Routes>
    </div>
  )
}

export default App