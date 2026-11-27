import { correlations } from '../data/catalog'

export interface VolumetricEfficiencyParams {
  measuredEtaRef: number
  referencePressureRatio: number
  targetPressureRatio: number
}

export interface VolumetricEfficiencyResult {
  etaRef: number
  etaTarget: number
  /** ηv que pedía la extrapolación antes de aplicar el límite físico. */
  etaTargetRaw: number
  /** `true` cuando la extrapolación chocó con etaMin/etaMax y se recortó. */
  targetClamped: boolean
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
 *   ηv(r) = k · [1 − c · (r^(1/n) − 1)]
 *
 * `c` es una constante de la máquina (volumen nocivo típico) y `k` el resto
 * de pérdidas, que se despeja del punto de catálogo para reproducir la
 * eficiencia medida exactamente en la referencia. Despejar `c` del único
 * dato disponible, como se hacía antes, le hacía absorber todas las demás
 * pérdidas y convertía la extrapolación en una caída explosiva en LBP
 * (ηv → 0 a relaciones de presión altas). No se usan tablas genéricas de ηv.
 */
export const anchorVolumetricEfficiency = ({
  measuredEtaRef,
  referencePressureRatio,
  targetPressureRatio,
}: VolumetricEfficiencyParams): VolumetricEfficiencyResult => {
  const config = correlations.compressor
  const exponent = config.clearanceExponent
  const rawEtaRef = measuredEtaRef
  const etaRef = clamp(measuredEtaRef, config.etaMin, config.etaMax)
  const refTerm = ratioTerm(referencePressureRatio, exponent)
  const targetTerm = ratioTerm(targetPressureRatio, exponent)

  const clearanceRatio = clamp(config.clearanceRatioTypical, 0.002, 0.45)
  const clearanceFactor = (term: number) =>
    Math.max(0.02, 1 - clearanceRatio * term)
  const otherEfficiency = etaRef / clearanceFactor(refTerm)

  const etaTargetRaw = otherEfficiency * clearanceFactor(targetTerm)
  const etaTarget = clamp(etaTargetRaw, config.etaMin, config.etaMax)
  const targetClamped = Math.abs(etaTarget - etaTargetRaw) > 1e-6
  const anchored = Math.abs(etaRef - rawEtaRef) < 0.002

  return {
    etaRef,
    etaTarget,
    etaTargetRaw,
    targetClamped,
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
