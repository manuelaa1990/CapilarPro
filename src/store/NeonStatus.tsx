import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { neonClient } from '../lib/neonClient'
import { NeonStatusContext, type NeonStatus } from './neonStatusContext'
import { useApp } from './useApp'

export const NeonStatusProvider = ({ children }: { children: ReactNode }) => {
  const { settings } = useApp()
  const [status, setStatusState] = useState<NeonStatus>('local')
  const setStatus = useCallback((nextStatus: NeonStatus) => {
    setStatusState(nextStatus)
  }, [])

  useEffect(() => {
    if (!settings.neonSyncEnabled) {
      setStatus('local')
      return
    }
    const client = neonClient
    if (!client || import.meta.env.MODE === 'test') {
      setStatus('local')
      return
    }

    let active = true
    const checkConnection = async () => {
      try {
        const { error } = await client
          .from('compressors')
          .select('id')
          .limit(1)
        if (!active) return
        if (error) {
          console.warn('La comprobación de Neon falló; se usará modo local.', error)
          setStatus('local')
          return
        }
        setStatus('connected')
      } catch (error) {
        if (!active) return
        console.warn('No se pudo comprobar la conexión con Neon.', error)
        setStatus('local')
      }
    }
    void checkConnection()

    return () => {
      active = false
    }
  }, [setStatus, settings.neonSyncEnabled])

  const value = useMemo(() => ({ status, setStatus }), [status, setStatus])

  return (
    <NeonStatusContext.Provider value={value}>
      {children}
    </NeonStatusContext.Provider>
  )
}
