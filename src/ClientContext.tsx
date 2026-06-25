import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getClients } from './api'

interface ClientInfo {
  id: string
  name: string
  slug: string
  status: string
  config?: {
    pageId: string | null
    tokenConfigured: boolean
    pixelId?: string
    formCount: number
  }
}

interface ClientContextValue {
  clients: ClientInfo[]
  currentClientId: string
  setCurrentClientId: (id: string) => void
  currentClient: ClientInfo | undefined
  loading: boolean
}

const ClientContext = createContext<ClientContextValue | null>(null)

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [currentClientId, setCurrentClientId] = useState('default')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClients()
      .then((data) => {
        setClients(data.clients || [])
        if (data.clients && data.clients.length > 0) {
          setCurrentClientId(data.clients[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const currentClient = clients.find((c) => c.id === currentClientId)

  return (
    <ClientContext.Provider value={{ clients, currentClientId, setCurrentClientId, currentClient, loading }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient(): ClientContextValue {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClient must be used within ClientProvider')
  return ctx
}