import type {
  CalculationInput,
  CalculationWarning,
  CapacityNormalization,
} from '../types'
import { capacityToWatts } from './units'

export type NormalizedCapacity = CapacityNormalization

export const normalizeCapacity = (
  input: CalculationInput,
  application: 'LBP' | 'MBP' | 'HBP',
): NormalizedCapacity => {
  const declared = input.declaredApplication ?? application
  const originalCapacityW = capacityToWatts(
    input.ratedCapacity,
    input.capacityUnit,
  )

  // Si la condición es la misma, no hay conversión
  if (declared === application) {
    return {
      originalCapacityW,
      capacityW: originalCapacityW,
      ratioUsed: 1.0,
      declaredApplication: declared,
      method: 'none',
      warnings: [],
    }
  }

  // Tabla de ratios empíricos (Target / Source)
  const RATIOS: Record<string, Record<string, number>> = {
    R134a: { 'HBP/LBP': 2.75, 'MBP/LBP': 2.1, 'HBP/MBP': 1.3 },
    R600a: { 'HBP/LBP': 2.6, 'MBP/LBP': 2.05, 'HBP/MBP': 1.27 },
    R290: { 'HBP/LBP': 2.8, 'MBP/LBP': 2.15, 'HBP/MBP': 1.3 },
    R404A: { 'HBP/LBP': 2.95, 'MBP/LBP': 2.25, 'HBP/MBP': 1.31 },
    R22: { 'HBP/LBP': 2.7, 'MBP/LBP': 2.05, 'HBP/MBP': 1.31 },
    R448A: { 'HBP/LBP': 2.9, 'MBP/LBP': 2.2, 'HBP/MBP': 1.32 },
    R449A: { 'HBP/LBP': 2.9, 'MBP/LBP': 2.2, 'HBP/MBP': 1.32 },
  }

  const refrigerant = input.refrigerantId as string
  const directKey = `${application}/${declared}`
  const inverseKey = `${declared}/${application}`

  let ratio = 1.0
  const warnings: CalculationWarning[] = []

  if (RATIOS[refrigerant]) {
    if (RATIOS[refrigerant][directKey]) {
      ratio = RATIOS[refrigerant][directKey]
    } else if (RATIOS[refrigerant][inverseKey]) {
      // Si la conversión es inversa (ej. HBP a LBP), dividimos 1 por el ratio directo
      ratio = 1 / RATIOS[refrigerant][inverseKey]
    } else {
      warnings.push({
        code: 'capacity-normalization-missing',
        severity: 'warning',
        title: 'Conversión no disponible',
        message: `No hay un ratio definido para ${refrigerant} de ${declared} a ${application}. Se usará la capacidad original.`,
      })
    }
  } else {
    // Refrigerante no listado en la tabla
    warnings.push({
      code: 'capacity-normalization-missing',
      severity: 'warning',
      title: 'Refrigerante no soportado en conversión',
      message: `El refrigerante ${refrigerant} no tiene ratios definidos. Se usará la capacidad original.`,
    })
  }

  const normalizedW = originalCapacityW * ratio

  if (ratio !== 1.0) {
    warnings.push({
      code: 'capacity-normalized',
      severity: 'info',
      title: 'Capacidad ajustada por condición',
      message: `Capacidad normalizada de ${declared} a ${application} (factor ${ratio.toFixed(2)}). El capilar se calcula con ${normalizedW.toFixed(0)} W en lugar de ${originalCapacityW.toFixed(0)} W.`,
    })
  }

  return {
    originalCapacityW,
    capacityW: normalizedW,
    ratioUsed: ratio,
    declaredApplication: declared,
    method: ratio !== 1.0 ? 'ratio-table' : 'none',
    warnings,
  }
}
