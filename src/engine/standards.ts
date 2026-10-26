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
  shRef: number
  scRef: number
}

const applicationConditions: Record<
  'ASHRAE' | 'EN 12900' | 'GB/T',
  Record<CompressorApplication, StandardConditions>
> = {
  ASHRAE: {
    LBP: { tEvapRef: -23.3, tCondRef: 54.4, shRef: 55.5, scRef: 0 },
    MBP: { tEvapRef: -6.7, tCondRef: 54.4, shRef: 38.9, scRef: 0 },
    HBP: { tEvapRef: 7.2, tCondRef: 54.4, shRef: 25, scRef: 0 },
  },
  'EN 12900': {
    LBP: { tEvapRef: -35, tCondRef: 40, shRef: 20, scRef: 0 },
    MBP: { tEvapRef: -10, tCondRef: 40, shRef: 20, scRef: 0 },
    HBP: { tEvapRef: 5, tCondRef: 50, shRef: 10, scRef: 0 },
  },
  'GB/T': {
    LBP: { tEvapRef: -25, tCondRef: 55, shRef: 20, scRef: 0 },
    MBP: { tEvapRef: -7, tCondRef: 55, shRef: 20, scRef: 0 },
    HBP: { tEvapRef: 7, tCondRef: 55, shRef: 20, scRef: 0 },
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
  return applicationConditions[norma][app]
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
