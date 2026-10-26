import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { compressorById, compressors, defaults, solutions } from '../data/catalog'
import { calculate } from '../engine/calculate'
import { predictLengthForDiameter } from '../engine/capillary'
import { saturationAtTemperature } from '../engine/properties'
import {
  getStandard,
  getStandardConditions,
  standardNameForId,
} from '../engine/standards'
import type {
  ActualOutcome,
  AppSettings,
  CalculationInput,
  CalculationResult,
  LearnedModel,
  RefrigerantId,
  SavedCase,
  StandardId,
  TabId,
} from '../types'
import { AppContext, type AppStore } from './useApp'
import { computeLearnedModel } from './mergedData'
import {
  clearAllData,
  exportData,
  importData,
  loadCases,
  loadSettings,
  saveCases,
  saveSettings,
  storageMode,
} from './userData'
import { defaultInput, defaultSettings } from './schemas'
import { fingerprintOf } from '../engine/fingerprint'
import { getOrCreateOwnerId } from '../lib/saveCalculation'

const parseTab = (): TabId => {
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (raw === 'history' || raw === 'model' || raw === 'settings') return raw
  return 'calculator'
}

const tabHash = (tab: TabId) => (tab === 'calculator' ? '#/' : `#/${tab}`)

const nowIso = () => new Date().toISOString()
const applicationForEvap = (
  temperatureC: number,
): CalculationInput['application'] =>
  temperatureC <= -20 ? 'LBP' : temperatureC <= 0 ? 'MBP' : 'HBP'

const referenceConditionsFor = (
  standardId: StandardId,
  application: CalculationInput['application'],
) => {
  const conditions = getStandardConditions(
    application,
    standardNameForId(standardId),
  )
  if (!conditions) return {}
  return {
    refEvapC: conditions.tEvapRef,
    refCondC: conditions.tCondRef,
    refSuperheatK: conditions.shRef,
    refSubcoolK: conditions.scRef,
  }
}

const makeId = () =>
  `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const pressuresFor = (input: CalculationInput) => ({
  high: saturationAtTemperature(input.refrigerantId, input.targetCondC)
    .pressureKPa,
  low: saturationAtTemperature(input.refrigerantId, input.targetEvapC)
    .pressureKPa,
})

const buildCase = (
  input: CalculationInput,
  result: CalculationResult,
  actual: ActualOutcome | null,
  source: SavedCase['source'],
  createdAt = nowIso(),
): SavedCase => ({
  id: makeId(),
  createdAt,
  updatedAt: createdAt,
  fingerprint: fingerprintOf(input),
  result,
  actual,
  source,
})

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [cases, setCases] = useState<SavedCase[]>(() => loadCases())
  const [input, setInput] = useState<CalculationInput>(() => {
    const stored = loadCases().at(0)
    if (stored) return stored.result.input
    return defaultInput()
  })
  const [tab, setTab] = useState<TabId>(() => parseTab())
  const [calculationError, setCalculationError] = useState<string | null>(null)
  const [learned, setLearned] = useState<LearnedModel>(() =>
    computeLearnedModel(loadCases(), defaultInput(), true),
  )
  const [hydrated, setHydrated] = useState(false)
  const mode = useMemo(() => storageMode(), [])

  useEffect(() => {
    try {
      getOrCreateOwnerId()
    } catch (error) {
      console.error('No se pudo preparar el identificador local de Neon.', error)
    }
    const onHash = () => setTab(parseTab())
    window.addEventListener('hashchange', onHash)
    setHydrated(true)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (hydrated) saveCases(cases)
  }, [cases, hydrated])

  useEffect(() => {
    if (hydrated) saveSettings(settings)
  }, [settings, hydrated])

  useEffect(() => {
    setLearned(computeLearnedModel(cases, input, settings.learningEnabled))
  }, [cases, input, settings.learningEnabled])

  const resultState = useMemo(() => {
    try {
      return {
        result: calculate(input, {
          calibration: learned.calibration,
        }),
        error: null as string | null,
      }
    } catch (error) {
      return {
        result: null,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo completar el cálculo',
      }
    }
  }, [input, learned.calibration])

  useEffect(() => {
    setCalculationError(resultState.error)
  }, [resultState.error])

  const currentSaved = useMemo(
    () =>
      cases.find(
        (item) => item.fingerprint === resultState.result?.fingerprint,
      ) ?? null,
    [cases, resultState.result?.fingerprint],
  )

  const navigate = useCallback((next: TabId) => {
    window.location.hash = tabHash(next)
    setTab(next)
  }, [])

  const updateInput = useCallback((patch: Partial<CalculationInput>) => {
    setInput((current) => ({ ...current, ...patch }))
  }, [])

  const chooseCompressor = useCallback((id: string) => {
    if (id === 'custom') {
      setInput((current) => ({
        ...current,
        compressorId: 'custom',
        compressorLabel: 'Compresor personalizado',
      }))
      return
    }
    const compressor = compressorById(id)
    if (!compressor) return
    const refrigerantId = compressor.refrigerants.includes(
      input.refrigerantId as RefrigerantId,
    )
      ? input.refrigerantId
      : compressor.refrigerants[0]
    const standard = getStandard(compressor.standardId)
    setInput((current) => ({
      ...current,
      compressorId: compressor.id,
      compressorLabel: `${compressor.brand} ${compressor.model}`,
      refrigerantId,
      standardId: compressor.standardId,
      application: applicationForEvap(compressor.ratedEvapC),
      ratedCapacityW: compressor.ratedCapacityW,
      displacementCm3Rev: compressor.displacementCm3Rev,
      refEvapC: compressor.ratedEvapC,
      refCondC: compressor.ratedCondC,
      refSuperheatK: compressor.ratedSuperheatK,
      refSubcoolK: compressor.ratedSubcoolK,
      targetEvapC:
        compressor.standardId === 'custom'
          ? current.targetEvapC
          : compressor.ratedEvapC + 12,
      targetCondC:
        compressor.standardId === 'custom'
          ? current.targetCondC
          : Math.min(standard.condC - 8, 48),
    }))
  }, [input.refrigerantId])

  const chooseRefrigerant = useCallback((id: RefrigerantId) => {
    if (input.compressorId === 'custom') {
      setInput((current) => ({
        ...current,
        refrigerantId: id,
      }))
      return
    }
    const currentCompressor = compressorById(input.compressorId)
    if (currentCompressor?.refrigerants.includes(id)) {
      setInput((current) => ({
        ...current,
        refrigerantId: id,
      }))
      return
    }
    const replacement = compressors.find((item) =>
      item.refrigerants.includes(id),
    )
    if (!replacement) {
      setInput((current) => ({ ...current, refrigerantId: id }))
      return
    }
    const standard = getStandard(replacement.standardId)
    setInput((current) => ({
      ...current,
      refrigerantId: id,
      compressorId: replacement.id,
      compressorLabel: `${replacement.brand} ${replacement.model}`,
      standardId: replacement.standardId,
      application: applicationForEvap(replacement.ratedEvapC),
      ratedCapacityW: replacement.ratedCapacityW,
      displacementCm3Rev: replacement.displacementCm3Rev,
      refEvapC: replacement.ratedEvapC,
      refCondC: replacement.ratedCondC,
      refSuperheatK: replacement.ratedSuperheatK,
      refSubcoolK: replacement.ratedSubcoolK,
      targetEvapC:
        replacement.standardId === 'custom'
          ? current.targetEvapC
          : replacement.ratedEvapC + 12,
      targetCondC:
        replacement.standardId === 'custom'
          ? current.targetCondC
          : Math.min(standard.condC - 8, 48),
    }))
  }, [input.compressorId])

  const chooseStandard = useCallback((id: StandardId) => {
    setInput((current) => ({
      ...current,
      standardId: id,
      ...referenceConditionsFor(id, current.application),
    }))
  }, [])

  const chooseApplication = useCallback(
    (application: CalculationInput['application']) => {
      setInput((current) => ({
        ...current,
        application,
        ...referenceConditionsFor(current.standardId, application),
      }))
    },
    [],
  )

  const saveCurrentCase = useCallback(
    (
      source: SavedCase['source'] = 'calculation',
      resultOverride?: CalculationResult,
    ) => {
      const current = resultOverride ?? resultState.result
      if (!current) return null
      let saved: SavedCase | null = null
      setCases((previous) => {
        const existing = previous.find(
          (item) => item.fingerprint === current.fingerprint,
        )
        if (existing) {
          saved = {
            ...existing,
            updatedAt: nowIso(),
            result: current,
            source: existing.source === 'demo' ? 'calculation' : source,
          }
          return previous.map((item) => (item.id === existing.id ? saved! : item))
        }
        saved = buildCase(current.input, current, null, source)
        return [saved, ...previous].slice(0, defaults.ui.maxCases)
      })
      return saved
    },
    [resultState.result],
  )

  const recordActual = useCallback(
    (
      caseId: string,
      actual: {
        diameterMm: number
        lengthM: number
        measuredEvapC: number | null
        measuredCapacityW: number | null
        notes: string
      },
    ) => {
      setCases((previous) =>
        previous.map((item) => {
          if (item.id !== caseId) return item
          const pressures = pressuresFor(item.result.input)
          const modeled = predictLengthForDiameter(
            item.result.input,
            item.result.compressor.massFlowKgS,
            pressures.high,
            pressures.low,
            actual.diameterMm,
          )
          return {
            ...item,
            updatedAt: nowIso(),
            actual: {
              diameterMm: actual.diameterMm,
              lengthM: actual.lengthM,
              measuredEvapC: actual.measuredEvapC,
              measuredCapacityW: actual.measuredCapacityW,
              modeledLengthAtActualM: modeled,
              notes: actual.notes,
              recordedAt: nowIso(),
            },
          }
        }),
      )
    },
    [],
  )

  const deleteCase = useCallback((id: string) => {
    setCases((previous) => previous.filter((item) => item.id !== id))
  }, [])

  const clearCases = useCallback(() => setCases([]), [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const loadDemoCases = useCallback(() => {
    const created: SavedCase[] = []
    const base = defaultInput()
    const start = Date.now()
    solutions.demoCases.forEach((demo, index) => {
      const compressor = compressorById(demo.compressorId)
      if (!compressor) return
      const demoInput: CalculationInput = {
        ...base,
        refrigerantId: demo.refrigerantId as RefrigerantId,
        compressorId: compressor.id,
        compressorLabel: `${compressor.brand} ${compressor.model}`,
        standardId: compressor.standardId,
        application: applicationForEvap(compressor.ratedEvapC),
        ratedCapacityW: compressor.ratedCapacityW,
        displacementCm3Rev: compressor.displacementCm3Rev,
        refEvapC: compressor.ratedEvapC,
        refCondC: compressor.ratedCondC,
        refSuperheatK: compressor.ratedSuperheatK,
        refSubcoolK: compressor.ratedSubcoolK,
        targetEvapC: demo.targetEvapC,
        targetCondC: demo.targetCondC,
        targetSuperheatK: 10,
        targetSubcoolK: 5,
        installedDiameterMm: demo.installedDiameterMm,
        installedLengthM: demo.installedLengthM,
        notes: 'Caso de demostración',
      }
      try {
        const demoResult = calculate(demoInput)
        const highPressure = saturationAtTemperature(
          demoInput.refrigerantId,
          demoInput.targetCondC,
        ).pressureKPa
        const lowPressure = saturationAtTemperature(
          demoInput.refrigerantId,
          demoInput.targetEvapC,
        ).pressureKPa
        const modeled = predictLengthForDiameter(
          demoInput,
          demoResult.compressor.massFlowKgS,
          highPressure,
          lowPressure,
          demo.installedDiameterMm,
        )
        const createdAt = new Date(start - index * 86_400_000 * 4).toISOString()
        created.push(
          buildCase(
            demoInput,
            demoResult,
            {
              diameterMm: demo.installedDiameterMm,
              lengthM: demo.installedLengthM,
              measuredEvapC: demo.targetEvapC,
              measuredCapacityW: null,
              modeledLengthAtActualM: modeled,
              notes: 'Caso de demostración cargado desde la biblioteca.',
              recordedAt: createdAt,
            },
            'demo',
            createdAt,
          ),
        )
      } catch {
        // Un demo incompatible no debe bloquear la carga del resto.
      }
    })
    setCases((previous) => {
      const existing = new Set(previous.map((item) => item.fingerprint))
      const unique = created.filter((item) => !existing.has(item.fingerprint))
      return [...unique, ...previous].slice(0, defaults.ui.maxCases)
    })
    return created.length
  }, [])

  const exportAll = useCallback(() => {
    exportData(settings, cases)
  }, [settings, cases])

  const importAll = useCallback(async (file: File) => {
    const imported = await importData(file)
    setCases((previous) =>
      [...imported.cases, ...previous].slice(0, defaults.ui.maxCases),
    )
    if (imported.settings) setSettings(imported.settings)
    return { received: imported.received, duplicates: imported.duplicates }
  }, [])

  const resetEverything = useCallback(() => {
    clearAllData()
    setCases([])
    setSettings(defaultSettings())
    setInput(defaultInput())
    setTab('calculator')
    window.location.hash = '#/'
  }, [])

  const dismissError = useCallback(() => setCalculationError(null), [])

  const value: AppStore = {
    settings,
    cases,
    input,
    result: resultState.result,
    calculationError,
    learned,
    tab,
    currentSaved,
    storageMode: mode,
    updateInput,
    chooseRefrigerant,
    chooseCompressor,
    chooseStandard,
    chooseApplication,
    saveCurrentCase,
    recordActual,
    deleteCase,
    clearCases,
    updateSettings,
    loadDemoCases,
    exportAll,
    importAll,
    resetEverything,
    navigate,
    dismissError,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
