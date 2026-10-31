import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { compressorById, compressors } from '../data/catalog'
import { calculate } from '../engine/calculate'
import {
  deriveReferenceSuperheatAndSubcooling,
  getStandard,
  getStandardConditions,
  standardNameForId,
} from '../engine/standards'
import type {
  CalculationInput,
  RefrigerantId,
  StandardId,
  TabId,
} from '../types'
import { AppContext, type AppStore } from './useApp'
import { defaultInput } from './schemas'
import {
  wattsToCapacity,
  cubicCentimetersToDisplacement,
} from '../engine/units'

const parseTab = (): TabId => {
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (raw === 'model') return raw
  return 'calculator'
}

const tabHash = (tab: TabId) => (tab === 'calculator' ? '#/' : `#/${tab}`)

const applicationForEvap = (
  temperatureC: number,
): CalculationInput['application'] =>
  temperatureC <= -20 ? 'LBP' : temperatureC <= 0 ? 'MBP' : 'HBP'
const frequencyForRpm = (rpm: number) =>
  Math.abs(rpm - 3000) <= Math.abs(rpm - 3600) ? 50 : 60

const referenceConditionsFor = (
  standardId: StandardId,
  application: CalculationInput['application'],
  current: Pick<
    CalculationInput,
    'refEvapC' | 'refCondC' | 'ambientTempC' | 'returnGasTempC'
  >,
) => {
  const conditions = getStandardConditions(
    application,
    standardNameForId(standardId),
  )
  const refEvapC = conditions?.tEvapRef ?? current.refEvapC
  const refCondC = conditions?.tCondRef ?? current.refCondC
  const ambientTempC = conditions?.ambientTempC ?? current.ambientTempC
  const returnGasTempC = conditions?.returnGasTempC ?? current.returnGasTempC
  const derived = deriveReferenceSuperheatAndSubcooling({
    refEvapC,
    refCondC,
    ambientTempC,
    returnGasTempC,
  })
  return {
    ...(conditions
      ? {
          refEvapC,
          refCondC,
          ambientTempC,
          returnGasTempC,
        }
      : {}),
    ...derived,
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [input, setInput] = useState<CalculationInput>(() => defaultInput())
  const [tab, setTab] = useState<TabId>(() => parseTab())
  const [calculationError, setCalculationError] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setTab(parseTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const resultState = useMemo(() => {
    try {
      return {
        result: calculate(input),
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
  }, [input])

  useEffect(() => {
    setCalculationError(resultState.error)
  }, [resultState.error])

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
    setInput((current) => {
      const targetEvapC =
        compressor.standardId === 'custom'
          ? current.targetEvapC
          : compressor.ratedEvapC + 12
      return {
        ...current,
        compressorId: compressor.id,
        compressorLabel: `${compressor.brand} ${compressor.model}`,
        refrigerantId,
        standardId: compressor.standardId,
        application: applicationForEvap(compressor.ratedEvapC),
        frequencyHz: frequencyForRpm(compressor.rpm),
        ratedCapacity: wattsToCapacity(
          compressor.ratedCapacityW,
          current.capacityUnit,
        ),
        displacement: cubicCentimetersToDisplacement(
          compressor.displacementCm3Rev,
          current.displacementUnit,
        ),
        refEvapC: compressor.ratedEvapC,
        refCondC: compressor.ratedCondC,
        refSuperheatK: compressor.ratedSuperheatK,
        refSubcoolK: compressor.ratedSubcoolK,
        targetEvapC,
        targetReturnGasTempC:
          current.targetReturnGasTempC +
          (targetEvapC - current.targetEvapC),
        targetCondC:
          compressor.standardId === 'custom'
            ? current.targetCondC
            : Math.min(standard.condC - 8, 48),
      }
    })
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
    setInput((current) => {
      const targetEvapC =
        replacement.standardId === 'custom'
          ? current.targetEvapC
          : replacement.ratedEvapC + 12
      return {
        ...current,
        refrigerantId: id,
        compressorId: replacement.id,
        compressorLabel: `${replacement.brand} ${replacement.model}`,
        standardId: replacement.standardId,
        application: applicationForEvap(replacement.ratedEvapC),
        frequencyHz: frequencyForRpm(replacement.rpm),
        ratedCapacity: wattsToCapacity(
          replacement.ratedCapacityW,
          current.capacityUnit,
        ),
        displacement: cubicCentimetersToDisplacement(
          replacement.displacementCm3Rev,
          current.displacementUnit,
        ),
        refEvapC: replacement.ratedEvapC,
        refCondC: replacement.ratedCondC,
        refSuperheatK: replacement.ratedSuperheatK,
        refSubcoolK: replacement.ratedSubcoolK,
        targetEvapC,
        targetReturnGasTempC:
          current.targetReturnGasTempC +
          (targetEvapC - current.targetEvapC),
        targetCondC:
          replacement.standardId === 'custom'
            ? current.targetCondC
            : Math.min(standard.condC - 8, 48),
      }
    })
  }, [input.compressorId])

  const chooseStandard = useCallback((id: StandardId) => {
    setInput((current) => ({
      ...current,
      standardId: id,
      ...referenceConditionsFor(id, current.application, current),
    }))
  }, [])

  const chooseApplication = useCallback(
    (application: CalculationInput['application']) => {
      setInput((current) => ({
        ...current,
        application,
        ...referenceConditionsFor(current.standardId, application, current),
      }))
    },
    [],
  )

  const dismissError = useCallback(() => setCalculationError(null), [])

  const value: AppStore = {
    input,
    result: resultState.result,
    calculationError,
    tab,
    updateInput,
    chooseRefrigerant,
    chooseCompressor,
    chooseStandard,
    chooseApplication,
    navigate,
    dismissError,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
