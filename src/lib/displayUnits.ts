export type DiameterDisplayUnit = 'mm' | 'in'
export type LengthDisplayUnit = 'm' | 'cm' | 'in'

export const MILLIMETERS_PER_INCH = 25.4
export const MILLIMETERS_PER_METER = 1000

/**
 * Convierte un diámetro interno (siempre en mm) a la unidad de visualización.
 * El motor de cálculo no se toca: solo cambia lo que se muestra.
 */
export const diameterFromMm = (
  valueMm: number,
  unit: DiameterDisplayUnit,
): number => (unit === 'in' ? valueMm / MILLIMETERS_PER_INCH : valueMm)

/**
 * Convierte una longitud interna (siempre en metros) a la unidad de visualización.
 */
export const lengthFromM = (
  valueM: number,
  unit: LengthDisplayUnit,
): number => {
  if (unit === 'cm') return valueM * 100
  if (unit === 'in') return (valueM * MILLIMETERS_PER_METER) / MILLIMETERS_PER_INCH
  return valueM
}

export const diameterDigits = (unit: DiameterDisplayUnit): number =>
  unit === 'in' ? 3 : 2

export const lengthDigits = (unit: LengthDisplayUnit): number =>
  unit === 'cm' ? 1 : 2

/**
 * Formatea con un número fijo de decimales. A diferencia de `fmt`, permite
 * tres decimales, necesarios para expresar diámetros pequeños en pulgadas.
 */
export const fmtFixed = (value: number, digits: number): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
