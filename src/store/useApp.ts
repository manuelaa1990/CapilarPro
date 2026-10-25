import { createContext, useContext } from 'react'
import type {
  AppSettings,
  CalculationInput,
  CalculationResult,
  LearnedModel,
  RefrigerantId,
  SavedCase,
  StandardId,
  TabId,
} from '../types'

export interface AppStore {
  settings: AppSettings
  cases: SavedCase[]
  input: CalculationInput
  result: CalculationResult | null
  calculationError: string | null
  learned: LearnedModel
  tab: TabId
  currentSaved: SavedCase | null
  storageMode: 'localStorage' | 'memoria'
  updateInput: (patch: Partial<CalculationInput>) => void
  chooseRefrigerant: (id: RefrigerantId) => void
  chooseCompressor: (id: string) => void
  chooseStandard: (id: StandardId) => void
  saveCurrentCase: (source?: SavedCase['source']) => SavedCase | null
  recordActual: (
    caseId: string,
    actual: {
      diameterMm: number
      lengthM: number
      measuredEvapC: number | null
      measuredCapacityW: number | null
      notes: string
    },
  ) => void
  deleteCase: (id: string) => void
  clearCases: () => void
  updateSettings: (patch: Partial<AppSettings>) => void
  loadDemoCases: () => number
  exportAll: () => void
  importAll: (file: File) => Promise<{ received: number; duplicates: number }>
  resetEverything: () => void
  navigate: (tab: TabId) => void
  dismissError: () => void
}

export const AppContext = createContext<AppStore | null>(null)

export const useApp = (): AppStore => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider')
  return context
}
