import { correlations } from '../data/catalog'

export interface VolumetricEfficiencyParams {
  measuredEtaRef: number
  referencePressureRatio: number
  targetPressureRatio: number
}

export interface VolumetricEfficiencyResult {
  etaRef: number
  etaTarget: number
  rawEtaRef: number
  clearanceRatio: number
  ratioTermRef: number
  ratioTermTarget: number
  anchored: boolean
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const ratioTerm = (ratio: number, exponent: number) =>
  Math.pow(Math.max(1, ratio), 1 / exponent) - 1

/**
 * Eficiencia volumétrica anclada a un punto medido de la placa.
 *
 * Modelo de volumen nocivo:
 *   ηv = 1 − λ − c · [(Pd/Ps)^(1/n) − 1]
 *
 * c se despeja del punto de catálogo. Así la extrapolación conserva la
 * eficiencia real del compresor en la referencia y solo escala por relación
 * de presiones. No se usan tablas genéricas de ηv.
 */
export const anchorVolumetricEfficiency = ({
  measuredEtaRef,
  referencePressureRatio,
  targetPressureRatio,
}: VolumetricEfficiencyParams): VolumetricEfficiencyResult => {
  const config = correlations.compressor
  const exponent = config.clearanceExponent
  const residual = config.residualLoss
  const rawEtaRef = measuredEtaRef
  const etaRef = clamp(measuredEtaRef, config.etaMin, config.etaMax)
  const refTerm = ratioTerm(referencePressureRatio, exponent)
  const targetTerm = ratioTerm(targetPressureRatio, exponent)

  const clearanceRatio = clamp(
    (1 - residual - etaRef) / Math.max(refTerm, 1e-6),
    0.002,
    0.45,
  )

  const etaTargetRaw = 1 - residual - clearanceRatio * targetTerm
  const etaTarget = clamp(etaTargetRaw, config.etaMin, config.etaMax)
  const anchored = Math.abs(etaRef - rawEtaRef) < 0.002

  return {
    etaRef,
    etaTarget,
    rawEtaRef,
    clearanceRatio,
    ratioTermRef: refTerm,
    ratioTermTarget: targetTerm,
    anchored,
  }
}

export const pressureRatio = (condensingKPa: number, evaporatingKPa: number) =>
  condensingKPa / Math.max(evaporatingKPa, 1)

export const volumetricEfficiencyConfidence = (
  referencePressureRatio: number,
  targetPressureRatio: number,
) => {
  const ratioJump = Math.abs(
    Math.log(Math.max(1, targetPressureRatio)) -
      Math.log(Math.max(1, referencePressureRatio)),
  )
  return clamp(1 - ratioJump * 0.22, 0.35, 1)
}
