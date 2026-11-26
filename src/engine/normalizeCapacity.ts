import type {
  CalculationInput,
  CalculationWarning,
  CapacityNormalization,
  CompressorApplication,
  RefrigerantId,
} from '../types'
import {
  saturationAtTemperature,
  subcooledLiquidState,
  superheatedVaporState,
} from './properties'
import { getStandardConditions, standardNameForId } from './standards'
import { capacityToWatts } from './units'

export type NormalizedCapacity = CapacityNormalization

type RegimeConditions = NonNullable<ReturnType<typeof getStandardConditions>>

/**
 * Capacidad específica por volumen barrido (ρ_succión · Δh) en un régimen
 * estándar. Es el índice físico que subyace al anclaje de ηv del motor:
 * Q = ηv · V_barrido · ρ_succión · Δh.
 */
const specificCapacityIndex = (
  refrigerantId: RefrigerantId,
  conditions: RegimeConditions,
): number | null => {
  try {
    const evaporation = saturationAtTemperature(
      refrigerantId,
      conditions.tEvapRef,
      'dew',
    )
    const condensation = saturationAtTemperature(
      refrigerantId,
      conditions.tCondRef,
      'bubble',
    )
    const suction = superheatedVaporState(
      refrigerantId,
      evaporation.pressureKPa,
      conditions.returnGasTempC,
    )
    const liquid = subcooledLiquidState(
      refrigerantId,
      condensation.pressureKPa,
      conditions.tCondRef - conditions.scRef,
    )
    const enthalpyDifference = suction.enthalpyKJkg - liquid.enthalpyKJkg
    if (
      !Number.isFinite(suction.densityKgM3) ||
      suction.densityKgM3 <= 0 ||
      !Number.isFinite(enthalpyDifference) ||
      enthalpyDifference <= 0
    ) {
      return null
    }
    return suction.densityKgM3 * enthalpyDifference
  } catch {
    return null
  }
}

/**
 * Ratio físico de capacidad entre dos regímenes del mismo refrigerante.
 * Asume ηv constante entre ambos puntos; el motor ancla después ηv en la
 * placa real, por lo que la conversión no depende de un factor empírico.
 */
const physicsRatio = (
  input: CalculationInput,
  from: CompressorApplication,
  to: CompressorApplication,
): number | null => {
  const standardName = standardNameForId(input.standardId)
  const fromConditions = getStandardConditions(from, standardName)
  const toConditions = getStandardConditions(to, standardName)
  if (!fromConditions || !toConditions) return null
  const fromIndex = specificCapacityIndex(input.refrigerantId, fromConditions)
  const toIndex = specificCapacityIndex(input.refrigerantId, toConditions)
  if (!fromIndex || !toIndex) return null
  return toIndex / fromIndex
}

export const normalizeCapacity = (
  input: CalculationInput,
  application: CompressorApplication,
): NormalizedCapacity => {
  const declared = input.declaredApplication ?? application
  const designRefrigerant = input.refrigerantId
  const requiredRefrigerant =
    input.requiredRefrigerantId ?? designRefrigerant
  const refrigerantChanged = requiredRefrigerant !== designRefrigerant
  const originalCapacityW = capacityToWatts(
    input.ratedCapacity,
    input.capacityUnit,
  )

  // Con cambio de refrigerante no se usa la tabla empírica del fluido de
  // diseño: el motor recalcula densidad, ηv y caudal con el fluido requerido.
  // La capacidad declarada queda como ancla del punto de placa.
  if (refrigerantChanged) {
    return {
      originalCapacityW,
      capacityW: originalCapacityW,
      ratioUsed: 1.0,
      declaredApplication: declared,
      designRefrigerant,
      requiredRefrigerant,
      refrigerantChanged: true,
      method: 'refrigerant-change',
      warnings: [],
    }
  }

  // Si la condición es la misma, no hay conversión
  if (declared === application) {
    return {
      originalCapacityW,
      capacityW: originalCapacityW,
      ratioUsed: 1.0,
      declaredApplication: declared,
      designRefrigerant,
      requiredRefrigerant,
      refrigerantChanged: false,
      method: 'none',
      warnings: [],
    }
  }

  const warnings: CalculationWarning[] = []
  let ratio = 1.0

  // CBP no tiene factores fijos en la tabla histórica. Su conversión se
  // deriva de las propiedades del refrigerante en cada régimen estándar.
  const usesPhysics = declared === 'CBP' || application === 'CBP'

  if (usesPhysics) {
    const derivedRatio = physicsRatio(input, declared, application)
    if (derivedRatio !== null) {
      ratio = derivedRatio
    } else {
      warnings.push({
        code: 'capacity-normalization-missing',
        severity: 'warning',
        title: 'Conversión física no disponible',
        message: `No se pudieron derivar las condiciones estándar para ${declared} a ${application}. Se usará la capacidad original.`,
      })
    }
  } else {
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
  }

  const method: CapacityNormalization['method'] =
    ratio === 1.0 ? 'none' : usesPhysics ? 'physics' : 'ratio-table'
  const normalizedW = originalCapacityW * ratio

  if (ratio !== 1.0) {
    warnings.push({
      code: 'capacity-normalized',
      severity: 'info',
      title: 'Capacidad ajustada por condición',
      message:
        method === 'physics'
          ? `Conversión de placa de ${declared} a ${application} (factor ${ratio.toFixed(2)}) a partir de ρ·Δh del refrigerante, sin factor empírico: ${originalCapacityW.toFixed(0)} W → ${normalizedW.toFixed(0)} W. El motor ancla ηv en la placa de diseño y extrapola al punto requerido.`
          : `Conversión de placa de ${declared} a ${application} (factor ${ratio.toFixed(2)}): ${originalCapacityW.toFixed(0)} W → ${normalizedW.toFixed(0)} W. El motor ancla ηv en la placa de diseño y extrapola al punto requerido.`,
    })
  }

  return {
    originalCapacityW,
    capacityW: normalizedW,
    ratioUsed: ratio,
    declaredApplication: declared,
    designRefrigerant,
    requiredRefrigerant,
    refrigerantChanged: false,
    method,
    warnings,
  }
}
