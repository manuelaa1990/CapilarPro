import type { CapacityUnit, DisplacementUnit } from '../types'

export const BTU_PER_HOUR_PER_WATT = 3.412
export const CUBIC_CENTIMETERS_PER_CUBIC_INCH = 16.387

export const capacityToWatts = (value: number, unit: CapacityUnit): number =>
  unit === 'BTU/h' ? value / BTU_PER_HOUR_PER_WATT : value

export const wattsToCapacity = (value: number, unit: CapacityUnit): number =>
  unit === 'BTU/h' ? value * BTU_PER_HOUR_PER_WATT : value

export const convertCapacity = (
  value: number,
  from: CapacityUnit,
  to: CapacityUnit,
): number => wattsToCapacity(capacityToWatts(value, from), to)

export const displacementToCubicCentimeters = (
  value: number,
  unit: DisplacementUnit,
): number =>
  unit === 'in³/rev'
    ? value * CUBIC_CENTIMETERS_PER_CUBIC_INCH
    : value

export const cubicCentimetersToDisplacement = (
  value: number,
  unit: DisplacementUnit,
): number =>
  unit === 'in³/rev'
    ? value / CUBIC_CENTIMETERS_PER_CUBIC_INCH
    : value

export const convertDisplacement = (
  value: number,
  from: DisplacementUnit,
  to: DisplacementUnit,
): number =>
  cubicCentimetersToDisplacement(
    displacementToCubicCentimeters(value, from),
    to,
  )
