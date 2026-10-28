import type { CalculationInput, CalculationResult } from '../types'
import { compressorById } from '../data/catalog'
import { rpmFromFrequency } from '../engine/frequency'
import {
  capacityToWatts,
  displacementToCubicCentimeters,
} from '../engine/units'
import { neonClient } from './neonClient'

const OWNER_ID_KEY = 'capilarpro:owner_id'
const PENDING_SOLUTIONS_KEY = 'capilarpro:v1:pending_solutions'
const LEGACY_PENDING_SOLUTIONS_KEY = 'pending_solutions'
const MAX_PENDING_CALCULATIONS = 100
const WATTS_TO_BTU_PER_HOUR = 3.412141633

export type SaveCalculationStatus = 'disabled' | 'queued' | 'synced'

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

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string): boolean => {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

const removeStorage = (key: string) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Sin acceso al almacenamiento no hay nada que limpiar.
  }
}

export const getOrCreateOwnerId = (): string => {
  const existing = readStorage(OWNER_ID_KEY)
  if (existing) return existing

  const ownerId = window.crypto.randomUUID()
  writeStorage(OWNER_ID_KEY, ownerId)
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

const isPendingCalculation = (value: unknown): value is PendingCalculation => {
  if (!value || typeof value !== 'object') return false
  const payload = value as {
    compressor?: unknown
    solution?: Record<string, unknown>
  }
  const solution = payload.solution
  return (
    Boolean(payload.compressor) &&
    Boolean(solution) &&
    typeof solution?.owner_id === 'string' &&
    typeof solution?.fingerprint_hash === 'string' &&
    typeof solution?.l_cap_m === 'number'
  )
}

const pendingKeyOf = (payload: PendingCalculation) => {
  const solution = payload.solution
  return [
    solution.fingerprint_hash,
    solution.t_evap_c,
    solution.t_cond_c,
    solution.t_return_gas_c,
    solution.t_ambient_c,
    solution.sh_k,
    solution.sc_k,
    solution.l_hx_m,
    solution.d_cap_mm,
    solution.l_cap_m,
  ].join('|')
}

const quarantineCorruptQueue = (stored: string) => {
  writeStorage(`${PENDING_SOLUTIONS_KEY}:corrupt`, stored)
}

const readPendingQueue = (): PendingCalculation[] => {
  const stored = readStorage(PENDING_SOLUTIONS_KEY)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) {
      quarantineCorruptQueue(stored)
      return []
    }
    return parsed.filter(isPendingCalculation)
  } catch {
    quarantineCorruptQueue(stored)
    return []
  }
}

const writePendingQueue = (pending: PendingCalculation[]): boolean => {
  const deduped = new Map<string, PendingCalculation>()
  for (const payload of pending) {
    const key = pendingKeyOf(payload)
    deduped.delete(key)
    deduped.set(key, payload)
  }
  const bounded = Array.from(deduped.values()).slice(
    -MAX_PENDING_CALCULATIONS,
  )
  return writeStorage(PENDING_SOLUTIONS_KEY, JSON.stringify(bounded))
}

const migrateLegacyQueue = () => {
  const legacy = readStorage(LEGACY_PENDING_SOLUTIONS_KEY)
  if (legacy === null) return

  let migrated: PendingCalculation[] = []
  try {
    const parsed = JSON.parse(legacy) as unknown
    if (Array.isArray(parsed)) {
      migrated = parsed.filter(isPendingCalculation)
    }
  } catch {
    quarantineCorruptQueue(legacy)
  }

  const merged = [...readPendingQueue(), ...migrated]
  if (writePendingQueue(merged) || merged.length === 0) {
    removeStorage(LEGACY_PENDING_SOLUTIONS_KEY)
  }
}

const queuePendingCalculation = (payload: PendingCalculation) => {
  migrateLegacyQueue()
  if (!writePendingQueue([...readPendingQueue(), payload])) {
    throw new Error('No se pudo escribir la cola local de sincronización.')
  }
}

export const pendingQueueSize = (): number => {
  migrateLegacyQueue()
  return readPendingQueue().length
}

export const clearSyncData = () => {
  removeStorage(OWNER_ID_KEY)
  removeStorage(PENDING_SOLUTIONS_KEY)
  removeStorage(LEGACY_PENDING_SOLUTIONS_KEY)
  removeStorage(`${PENDING_SOLUTIONS_KEY}:corrupt`)
}

const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ? error.message
      : 'Error desconocido en Neon Data API'

export const confidenceToDatabase = (confidenceScore: number) =>
  confidenceScore / 100

const pushPayload = async (payload: PendingCalculation): Promise<void> => {
  if (!neonClient) {
    throw new Error('Neon no está configurado en este build.')
  }

  const { compressor, solution } = payload
  const fingerprintHash = solution.fingerprint_hash
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

  const { error: insertSolutionError } = await neonClient
    .from('solutions')
    .insert(solution)

  if (insertSolutionError) {
    throw new Error(`No se pudo guardar la solución: ${messageOf(insertSolutionError)}`)
  }
}

export const flushPendingQueue = async (): Promise<number> => {
  if (!neonClient || import.meta.env.MODE === 'test') return 0

  migrateLegacyQueue()
  const pending = readPendingQueue()
  if (pending.length === 0) return 0

  const remaining: PendingCalculation[] = []
  let flushed = 0
  let blocked = false

  for (const payload of pending) {
    if (blocked) {
      remaining.push(payload)
      continue
    }
    try {
      await pushPayload(payload)
      flushed += 1
    } catch (error) {
      blocked = true
      remaining.push(payload)
      console.warn(
        'No se pudo sincronizar un cálculo pendiente; se reintentará más tarde.',
        error,
      )
    }
  }

  if (!writePendingQueue(remaining)) {
    console.warn('No se pudo actualizar la cola local tras sincronizar.')
  }
  return flushed
}

const buildPayload = async (
  result: CalculationResult,
): Promise<PendingCalculation> => {
  const { input } = result
  const ownerId = getOrCreateOwnerId()
  const selectedCompressor = compressorById(input.compressorId)
  const fingerprintHash =
    selectedCompressor?.fingerprintHash ??
    (await compressorFingerprint(input))
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
    l_hx_m: result.slhx?.lengthWoundM ?? input.lHxM ?? 0,
    d_cap_mm: result.capillary.diameterMm,
    l_cap_m: result.capillary.lengthM,
    eta_v: result.compressor.etaVolumetricTarget,
    m_dot_kg_s: result.compressor.massFlowKgS,
    q_calc_btu: result.compressor.capacityW * WATTS_TO_BTU_PER_HOUR,
    confidence: confidenceToDatabase(result.uncertainty.confidenceScore),
    uncertainty_pct: result.uncertainty.totalPct,
  }
  return { compressor, solution }
}

export const saveCalculation = async (
  result: CalculationResult,
  syncEnabled = false,
): Promise<SaveCalculationStatus> => {
  if (!syncEnabled) return 'disabled'
  if (!neonClient || import.meta.env.MODE === 'test') return 'disabled'

  let payload: PendingCalculation
  try {
    payload = await buildPayload(result)
  } catch (error) {
    console.error('Falló la preparación del cálculo para guardar.', error)
    throw new Error(
      `No se pudo preparar el cálculo para guardar: ${messageOf(error)}`,
    )
  }

  try {
    await pushPayload(payload)
    return 'synced'
  } catch (error) {
    try {
      queuePendingCalculation(payload)
    } catch (storageError) {
      console.error('Falló el guardado remoto y el respaldo local.', error, storageError)
      throw new Error(
        `Falló Neon (${messageOf(error)}) y tampoco se pudo guardar el respaldo local (${messageOf(storageError)}).`,
      )
    }

    console.error(
      'El cálculo quedó en la cola local pendiente de sincronizar.',
      error,
    )
    return 'queued'
  }
}
