import { correlations } from '../data/catalog'
import type { CalculationInput } from '../types'
import { rpmFromFrequency } from './frequency'
import {
  capacityToWatts,
  displacementToCubicCentimeters,
} from './units'

const normalizeNumber = (value: number, decimals = 3) => {
  if (!Number.isFinite(value)) return 'nan'
  return value.toFixed(decimals).replace(/\.?0+$/, '')
}

const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase()
}

/**
 * Huella reproducible del caso. Cambiar cualquier dato que altere la física
 * produce una huella distinta; el orden de las claves no influye.
 */
export const fingerprintOf = (input: CalculationInput): string => {
  const payload: Record<string, string> = {
    v: correlations.fingerprint.salt,
    refrigerantId: input.refrigerantId,
    compressorId: input.compressorId,
    standardId: input.standardId,
    application: input.application,
    ratedCapacityW: normalizeNumber(
      capacityToWatts(input.ratedCapacity, input.capacityUnit),
      1,
    ),
    displacementCm3Rev: normalizeNumber(
      displacementToCubicCentimeters(input.displacement, input.displacementUnit),
    ),
    rpm: normalizeNumber(rpmFromFrequency(input.frequencyHz), 0),
    refEvapC: normalizeNumber(input.refEvapC, 2),
    refCondC: normalizeNumber(input.refCondC, 2),
    ambientTempC: normalizeNumber(input.ambientTempC, 2),
    returnGasTempC: normalizeNumber(input.returnGasTempC, 2),
    refSuperheatK: normalizeNumber(input.refSuperheatK, 2),
    refSubcoolK: normalizeNumber(input.refSubcoolK, 2),
    targetEvapC: normalizeNumber(input.targetEvapC, 2),
    targetCondC: normalizeNumber(input.targetCondC, 2),
    targetReturnGasTempC: normalizeNumber(input.targetReturnGasTempC, 2),
    targetAmbientTempC: normalizeNumber(input.targetAmbientTempC, 2),
    targetSuperheatK: normalizeNumber(input.targetSuperheatK, 2),
    targetSubcoolK: normalizeNumber(input.targetSubcoolK, 2),
    ...(input.slhxActivo
      ? {
          slhxActivo: 'true',
          slhxPorcentaje: normalizeNumber(input.slhxPorcentaje, 0),
          slhxDiametroSuccion: input.slhxDiametroSuccion,
        }
      : {}),
  }
  const stable = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('|')
  return `CP-${fnv1a(stable)}`
}

export const shortFingerprint = (fingerprint: string): string =>
  fingerprint.replace('CP-', '').slice(0, correlations.fingerprint.displayLength)
