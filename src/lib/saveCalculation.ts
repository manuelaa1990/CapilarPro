import type { CalculationInput, CalculationResult } from '../types'
import { compressorById } from '../data/catalog'
import { rpmFromFrequency } from '../engine/frequency'
import {
  capacityToWatts,
  displacementToCubicCentimeters,
} from '../engine/units'
import { neonClient } from './neonClient'

const OWNER_ID_KEY = 'capilarpro:owner_id'
const PENDING_SOLUTIONS_KEY = 'pending_solutions'
const WATTS_TO_BTU_PER_HOUR = 3.412141633

interface PendingCalculation {
  compressor: {
    owner_id: string
    fingerprint_hash: string
    modelo: string
    refrigerante: string
    vd_cm3: number
    rpm: number
    q_ref_btu: number
    t_evap_ref_c: number
    t_cond_ref_c: number
    sh_ref_k: number
    sc_ref_k: number
  }
  solution: {
    compressor_id?: string
    owner_id: string
    fingerprint_hash: string
    t_evap_c: number
    t_cond_c: number
    t_return_gas_c: number
    t_ambient_c: number
    sh_k: number
    sc_k: number
    l_hx_m: number
    d_cap_mm: number
    l_cap_m: number
    eta_v: number
    m_dot_kg_s: number
    q_calc_btu: number
    confidence: number
    uncertainty_pct: number
  }
}

export const getOrCreateOwnerId = (): string => {
  const existing = window.localStorage.getItem(OWNER_ID_KEY)
  if (existing) return existing

  const ownerId = window.crypto.randomUUID()
  window.localStorage.setItem(OWNER_ID_KEY, ownerId)
  return ownerId
}

const compressorFingerprint = async (input: CalculationInput) => {
  const roundTo = (value: number, decimals: number) =>
    Number(value.toFixed(decimals))
  const stableData = JSON.stringify({
    compressorId: input.compressorId,
    compressorLabel: input.compressorLabel,
    refrigerantId: input.refrigerantId,
    ratedCapacityW: roundTo(
      capacityToWatts(input.ratedCapacity, input.capacityUnit),
      0,
    ),
    displacementCm3Rev: roundTo(
      displacementToCubicCentimeters(input.displacement, input.displacementUnit),
      1,
    ),
    rpm: roundTo(rpmFromFrequency(input.frequencyHz), 0),
    refEvapC: roundTo(input.refEvapC, 1),
    refCondC: roundTo(input.refCondC, 1),
    refSuperheatK: roundTo(input.refSuperheatK, 1),
    refSubcoolK: roundTo(input.refSubcoolK, 1),
  })
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(stableData),
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const queuePendingCalculation = (payload: PendingCalculation) => {
  const stored = window.localStorage.getItem(PENDING_SOLUTIONS_KEY)
  const pending: PendingCalculation[] = stored ? JSON.parse(stored) : []
  if (!Array.isArray(pending)) {
    throw new Error('La cola local pending_solutions no tiene un formato válido.')
  }
  pending.push(payload)
  window.localStorage.setItem(PENDING_SOLUTIONS_KEY, JSON.stringify(pending))
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Error desconocido en Neon Data API'

export const saveCalculation = async (
  result: CalculationResult,
): Promise<boolean> => {
  let payload: PendingCalculation | null = null

  try {
    const { input } = result
    const ownerId = getOrCreateOwnerId()
    const selectedCompressor = compressorById(input.compressorId)
    const fingerprintHash =
      selectedCompressor?.fingerprintHash ?? (await compressorFingerprint(input))
    const compressor = {
      owner_id: ownerId,
      fingerprint_hash: fingerprintHash,
      modelo: input.compressorLabel,
      refrigerante: input.refrigerantId,
      vd_cm3: displacementToCubicCentimeters(
        input.displacement,
        input.displacementUnit,
      ),
      rpm: rpmFromFrequency(input.frequencyHz),
      q_ref_btu:
        capacityToWatts(input.ratedCapacity, input.capacityUnit) *
        WATTS_TO_BTU_PER_HOUR,
      t_evap_ref_c: input.refEvapC,
      t_cond_ref_c: input.refCondC,
      sh_ref_k: input.refSuperheatK,
      sc_ref_k: input.refSubcoolK,
    }
    const solution: PendingCalculation['solution'] = {
      owner_id: ownerId,
      fingerprint_hash: fingerprintHash,
      t_evap_c: input.targetEvapC,
      t_cond_c: input.targetCondC,
      t_return_gas_c: input.targetReturnGasTempC,
      t_ambient_c: input.targetAmbientTempC,
      sh_k: result.input.targetSuperheatK,
      sc_k: input.targetSubcoolK,
      l_hx_m: input.lHxM ?? 0,
      d_cap_mm: result.capillary.diameterMm,
      l_cap_m: result.capillary.lengthM,
      eta_v: result.compressor.etaVolumetricTarget,
      m_dot_kg_s: result.compressor.massFlowKgS,
      q_calc_btu: result.compressor.capacityW * WATTS_TO_BTU_PER_HOUR,
      confidence: result.uncertainty.confidenceScore,
      uncertainty_pct: result.uncertainty.totalPct,
    }
    payload = { compressor, solution }

    if (!neonClient || import.meta.env.MODE === 'test') {
      queuePendingCalculation(payload)
      return false
    }

    const { data: matches, error: lookupError } = await neonClient
      .from('compressors')
      .select('id')
      .eq('fingerprint_hash', fingerprintHash)
      .limit(1)

    if (lookupError) {
      throw new Error(`No se pudo consultar el compresor: ${messageOf(lookupError)}`)
    }

    let compressorId = matches?.[0]?.id

    if (compressorId === undefined || compressorId === null) {
      const { data: insertedCompressor, error: insertCompressorError } =
        await neonClient
          .from('compressors')
          .insert(compressor)
          .select('id')
          .single()

      if (insertCompressorError) {
        throw new Error(
          `No se pudo guardar el compresor: ${messageOf(insertCompressorError)}`,
        )
      }
      compressorId = insertedCompressor?.id
    }

    if (typeof compressorId !== 'string') {
      throw new Error('Neon no devolvió un UUID válido para el compresor.')
    }

    solution.compressor_id = compressorId
    payload.solution.compressor_id = compressorId

    const { error: insertSolutionError } = await neonClient
      .from('solutions')
      .insert(solution)

    if (insertSolutionError) {
      throw new Error(`No se pudo guardar la solución: ${messageOf(insertSolutionError)}`)
    }

    return true
  } catch (error) {
    if (!payload) {
      console.error('Falló el guardado de la solución.', error)
      throw new Error(
        `No se pudo preparar el cálculo para guardar: ${messageOf(error)}`,
      )
    }

    try {
      queuePendingCalculation(payload)
    } catch (storageError) {
      console.error('Falló el guardado remoto y el respaldo local.', error, storageError)
      throw new Error(
        `Falló Neon (${messageOf(error)}) y tampoco se pudo guardar el respaldo local (${messageOf(storageError)}).`,
      )
    }

    console.error('El cálculo se guardó en la cola local pending_solutions.', error)
    return false
  }
}
