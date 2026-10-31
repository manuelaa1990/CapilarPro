import { createContext, useContext } from 'react'
import type {
  CalculationInput,
  CalculationResult,
  RefrigerantId,
  StandardId,
  TabId,
} from '../types'

export interface AppStore {
  input: CalculationInput
  result: CalculationResult | null
  calculationError: string | null
  tab: TabId
  updateInput: (patch: Partial<CalculationInput>) => void
  chooseRefrigerant: (id: RefrigerantId) => void
  chooseCompressor: (id: string) => void
  chooseStandard: (id: StandardId) => void
  chooseApplication: (application: CalculationInput['application']) => void
  navigate: (tab: TabId) => void
  dismissError: () => void
}

export const AppContext = createContext<AppStore | null>(null)

export const useApp = (): AppStore => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider')
  return context
}
