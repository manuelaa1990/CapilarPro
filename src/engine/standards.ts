import { standardById, standards } from '../data/catalog'
import type {
  CalculationInput,
  CompressorApplication,
  StandardCondition,
  StandardId,
} from '../types'

export const getStandard = (id: StandardId): StandardCondition => standardById(id)

export const standardsList = (): StandardCondition[] => standards

export interface StandardConditions {
  tEvapRef: number
  tCondRef: number
  ambientTempC: number
  returnGasTempC: number
  shRef: number
  scRef: number
}

interface StandardTemperatureConditions {
  tEvapRef: number
  tCondRef: number
  ambientTempC: number
  returnGasTempC: number
}

export const deriveReferenceSuperheatAndSubcooling = ({
  refEvapC,
  refCondC,
  ambientTempC,
  returnGasTempC,
}: Pick<
  CalculationInput,
  'refEvapC' | 'refCondC' | 'ambientTempC' | 'returnGasTempC'
>) => ({
  refSuperheatK: Number(Math.max(0, returnGasTempC - refEvapC).toFixed(1)),
  refSubcoolK: Number(Math.max(0, refCondC - ambientTempC).toFixed(1)),
})

const applicationConditions: Record<
  'ASHRAE' | 'EN 12900' | 'GB/T',
  Record<CompressorApplication, StandardTemperatureConditions>
> = {
  ASHRAE: {
    LBP: { tEvapRef: -23.3, tCondRef: 54.4, ambientTempC: 32.2, returnGasTempC: 32.2 },
    MBP: { tEvapRef: -6.7, tCondRef: 54.4, ambientTempC: 32.2, returnGasTempC: 32.2 },
    HBP: { tEvapRef: 7.2, tCondRef: 54.4, ambientTempC: 32.2, returnGasTempC: 32.2 },
  },
  'EN 12900': {
    LBP: { tEvapRef: -35, tCondRef: 40, ambientTempC: 32.2, returnGasTempC: 32.2 },
    MBP: { tEvapRef: -10, tCondRef: 40, ambientTempC: 32.2, returnGasTempC: 32.2 },
    HBP: { tEvapRef: 5, tCondRef: 50, ambientTempC: 32.2, returnGasTempC: 32.2 },
  },
  'GB/T': {
    LBP: { tEvapRef: -25, tCondRef: 55, ambientTempC: 32.2, returnGasTempC: 32.2 },
    MBP: { tEvapRef: -7, tCondRef: 55, ambientTempC: 32.2, returnGasTempC: 32.2 },
    HBP: { tEvapRef: 7, tCondRef: 55, ambientTempC: 32.2, returnGasTempC: 32.2 },
  },
}

export const getStandardConditions = (
  app: string,
  norma: string,
): StandardConditions | null => {
  if (
    (app !== 'LBP' && app !== 'MBP' && app !== 'HBP') ||
    (norma !== 'ASHRAE' && norma !== 'EN 12900' && norma !== 'GB/T')
  ) {
    return null
  }
  const temperatures = applicationConditions[norma][app]
  const derived = deriveReferenceSuperheatAndSubcooling({
    refEvapC: temperatures.tEvapRef,
    refCondC: temperatures.tCondRef,
    ambientTempC: temperatures.ambientTempC,
    returnGasTempC: temperatures.returnGasTempC,
  })
  return {
    ...temperatures,
    shRef: derived.refSuperheatK,
    scRef: derived.refSubcoolK,
  }
}

export const standardNameForId = (id: StandardId): string => {
  switch (id) {
    case 'ahri540':
      return 'ASHRAE'
    case 'en12900':
      return 'EN 12900'
    case 'gb-t':
      return 'GB/T'
    case 'custom':
      return 'Personalizada'
    case 'ahri-legacy':
      return 'AHRI histórico'
  }
}

export const applyStandard = (
  id: StandardId,
  current: Pick<
    CalculationInput,
    'refEvapC' | 'refCondC' | 'refSuperheatK' | 'refSubcoolK'
  >,
) => {
  const standard = getStandard(id)
  if (id === 'custom') return current
  return {
    refEvapC: standard.evapC,
    refCondC: standard.condC,
    refSuperheatK: standard.superheatK,
    refSubcoolK: standard.subcoolK,
  }
}

export const standardDeviation = (
  input: CalculationInput,
  standard: StandardCondition,
): number => {
  const applicationStandard = getStandardConditions(
    input.application,
    standardNameForId(input.standardId),
  )
  const reference = applicationStandard
    ? {
        evapC: applicationStandard.tEvapRef,
        condC: applicationStandard.tCondRef,
        superheatK: applicationStandard.shRef,
        subcoolK: applicationStandard.scRef,
      }
    : standard
  const weighted =
    Math.abs(input.refEvapC - reference.evapC) +
    Math.abs(input.refCondC - reference.condC) * 0.6 +
    Math.abs(input.refSuperheatK - reference.superheatK) * 0.35 +
    Math.abs(input.refSubcoolK - reference.subcoolK) * 0.25
  return weighted
}

export const conditionLabel = (input: CalculationInput): string =>
  `${input.targetEvapC.toFixed(1)} / ${input.targetCondC.toFixed(1)} °C`
