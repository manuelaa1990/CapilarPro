import { standardById, standards } from '../data/catalog'
import type { CalculationInput, StandardCondition, StandardId } from '../types'

export const getStandard = (id: StandardId): StandardCondition => standardById(id)

export const standardsList = (): StandardCondition[] => standards

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
  const weighted =
    Math.abs(input.refEvapC - standard.evapC) +
    Math.abs(input.refCondC - standard.condC) * 0.6 +
    Math.abs(input.refSuperheatK - standard.superheatK) * 0.35 +
    Math.abs(input.refSubcoolK - standard.subcoolK) * 0.25
  return weighted
}

export const conditionLabel = (input: CalculationInput): string =>
  `${input.targetEvapC.toFixed(1)} / ${input.targetCondC.toFixed(1)} °C`
