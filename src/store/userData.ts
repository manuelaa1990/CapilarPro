import { defaults } from '../data/catalog'
import type { AppSettings, SavedCase } from '../types'
import {
  defaultSettings,
  parseImportedCases,
  parseStoredState,
  savedCaseSchema,
} from './schemas'

const KEYS = {
  cases: 'capilarpro:v1:cases',
  settings: 'capilarpro:v1:settings',
  meta: 'capilarpro:v1:meta',
} as const

const memoryStore = new Map<string, string>()

const storageAvailable = () => {
  try {
    const probe = '__capilarpro_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

const read = (key: string): string | null => {
  if (storageAvailable()) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return memoryStore.get(key) ?? null
    }
  }
  return memoryStore.get(key) ?? null
}

const write = (key: string, value: string) => {
  if (storageAvailable()) {
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch {
      memoryStore.set(key, value)
      return false
    }
  }
  memoryStore.set(key, value)
  return false
}

const remove = (key: string) => {
  if (storageAvailable()) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // La copia en memoria se elimina igualmente.
    }
  }
  memoryStore.delete(key)
}

export const loadCases = (): SavedCase[] => {
  const raw = read(KEYS.cases)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const cases = parsed
        .map((item) => savedCaseSchema.safeParse(item))
        .filter((item) => item.success)
        .map((item) => item.data as unknown as SavedCase)
      return cases
    }
    return []
  } catch {
    return []
  }
}

export const saveCases = (cases: SavedCase[]) => {
  write(KEYS.cases, JSON.stringify(cases.slice(0, defaults.ui.maxCases)))
}

export const loadSettings = (): AppSettings => {
  const raw = read(KEYS.settings)
  if (!raw) return defaultSettings()
  try {
    const parsed = JSON.parse(raw) as unknown
    const result = parseStoredState(
      JSON.stringify({
        version: 1,
        settings: parsed,
        cases: [],
        lastUpdated: new Date().toISOString(),
      }),
    )
    if (result.success) return result.data.settings
  } catch {
    // Se usa la configuración por defecto.
  }
  return defaultSettings()
}

export const saveSettings = (settings: AppSettings) => {
  write(KEYS.settings, JSON.stringify(settings))
}

export const clearAllData = () => {
  remove(KEYS.cases)
  remove(KEYS.settings)
  remove(KEYS.meta)
  memoryStore.clear()
}

export const storageMode = (): 'localStorage' | 'memoria' =>
  storageAvailable() ? 'localStorage' : 'memoria'

export const exportData = (settings: AppSettings, cases: SavedCase[]) => {
  const payload = {
    app: 'CapilarPro',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings,
    cases,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `capilarpro-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  cases: SavedCase[]
  settings?: AppSettings
  received: number
  duplicates: number
}

export const importData = async (file: File): Promise<ImportResult> => {
  const text = await file.text()
  const envelope = parseImportedCases(text)
  if (!envelope) {
    throw new Error('El archivo no es un respaldo válido de CapilarPro')
  }
  const existing = loadCases()
  const fingerprints = new Set(existing.map((item) => item.fingerprint))
  const incoming = envelope.cases as unknown as SavedCase[]
  const unique = incoming.filter((item) => !fingerprints.has(item.fingerprint))
  return {
    cases: unique,
    settings: envelope.settings,
    received: incoming.length,
    duplicates: incoming.length - unique.length,
  }
}

export const storageKeys = KEYS
