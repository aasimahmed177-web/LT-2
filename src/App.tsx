import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Events from './pages/Events'
import Telecalling from './pages/Telecalling'
import Settings from './pages/Settings'
import CsvImport from './pages/CsvImport'
import { ClientProvider } from './ClientContext'

function App() {
  return (
    <ClientProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/events" element={<Events />} />
          <Route path="/telecalling" element={<Telecalling />} />
          <Route path="/csv-import" element={<CsvImport />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </ClientProvider>
  )
}

export default App