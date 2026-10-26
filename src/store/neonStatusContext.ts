import { createContext, useContext } from 'react'

export type NeonStatus = 'connected' | 'local'

export interface NeonStatusContextValue {
  status: NeonStatus
  setStatus: (status: NeonStatus) => void
}

export const NeonStatusContext =
  createContext<NeonStatusContextValue | null>(null)

export const useNeonStatus = () => {
  const context = useContext(NeonStatusContext)
  if (!context) {
    throw new Error('useNeonStatus debe usarse dentro de NeonStatusProvider')
  }
  return context
}
