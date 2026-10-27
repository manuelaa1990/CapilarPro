import { z } from 'zod'
import type {
  AppSettings,
  CalculationInput,
  RefrigerantId,
  SavedCase,
  StandardId,
} from '../types'
import { defaults } from '../data/catalog'
import {
  capacityToWatts,
  displacementToCubicCentimeters,
} from '../engine/units'

const refrigerantEnum = z.enum([
  'R134a',
  'R600a',
  'R404A',
  'R290',
  'R22',
  'R507A',
  'R407C',
  'R417A',
  'R422D',
  'R427A',
])
const standardEnum = z.enum([
  'ahri540',
  'en12900',
  'ahri-legacy',
  'gb-t',
  'custom',
])
const applicationEnum = z.enum(['LBP', 'MBP', 'HBP'])

const nullablePositive = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .nullable()

const calculationInputObjectSchema = z
  .object({
    refrigerantId: refrigerantEnum,
    compressorId: z.string().min(1),
    compressorLabel: z.string().max(160),
    standardId: standardEnum,
    application: applicationEnum,
    ratedCapacity: z.number().positive(),
    capacityUnit: z.enum(['W', 'BTU/h']),
    displacement: z.number().positive(),
    displacementUnit: z.enum(['cm³/rev', 'in³/rev']),
    frequencyHz: z.union([z.literal(50), z.literal(60)]),
    refEvapC: z.number().min(-65).max(30),
    refCondC: z.number().min(20).max(67),
    ambientTempC: z.number().min(-65).max(67),
    returnGasTempC: z.number().min(-65).max(100),
    refSuperheatK: z.number().min(0).max(200),
    refSubcoolK: z.number().min(0).max(100),
    targetEvapC: z.number().min(-55).max(20),
    targetCondC: z.number().min(20).max(67),
    targetReturnGasTempC: z.number().min(-55).max(100),
    targetAmbientTempC: z.number().min(-20).max(60),
    targetSuperheatK: z.number().min(0).max(200),
    targetSubcoolK: z.number().min(0).max(30),
    slhxActivo: z.boolean(),
    slhxEfectividad: z.number().min(0).max(1),
    installedDiameterMm: nullablePositive(0.3, 3.5),
    installedLengthM: nullablePositive(0.1, 10),
    notes: z.string().max(1200),
  })

export const calculationInputSchema = z
  .preprocess((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    const input = value as Record<string, unknown>
    let migrated: Record<string, unknown> = input
    if (migrated.ratedCapacity === undefined && typeof input.ratedCapacityW === 'number') {
      migrated = { ...migrated, ratedCapacity: input.ratedCapacityW }
    }
    if (migrated.displacement === undefined && typeof input.displacementCm3Rev === 'number') {
      migrated = { ...migrated, displacement: input.displacementCm3Rev }
    }
    if (migrated.ratedCapacityW !== undefined || migrated.displacementCm3Rev !== undefined) {
      migrated = { ...migrated }
      delete migrated.ratedCapacityW
      delete migrated.displacementCm3Rev
    }
    const legacyRpm = input.rpm
    if (input.frequencyHz === undefined && typeof legacyRpm === 'number') {
      const legacyInput = { ...migrated }
      delete legacyInput.rpm
      migrated = {
        ...legacyInput,
        frequencyHz: legacyRpm <= 3300 ? 50 : 60,
      }
    }
    if (migrated.application === undefined) {
      const refEvapC =
        typeof migrated.refEvapC === 'number' ? migrated.refEvapC : 7
      migrated = {
        ...migrated,
        application: refEvapC <= -20 ? 'LBP' : refEvapC <= 0 ? 'MBP' : 'HBP',
      }
    }
    migrated = {
      ...migrated,
      capacityUnit: migrated.capacityUnit ?? 'W',
      displacementUnit: migrated.displacementUnit ?? 'cm³/rev',
      slhxActivo: migrated.slhxActivo ?? false,
      slhxEfectividad: migrated.slhxEfectividad ?? 0.7,
      ambientTempC: migrated.ambientTempC ?? 32.2,
      returnGasTempC: migrated.returnGasTempC ?? 32.2,
    }
    if (migrated.targetReturnGasTempC === undefined) {
      migrated = {
        ...migrated,
        targetReturnGasTempC:
          (typeof migrated.targetEvapC === 'number' ? migrated.targetEvapC : -5) +
          (typeof migrated.targetSuperheatK === 'number' ? migrated.targetSuperheatK : 10),
      }
    }
    migrated = {
      ...migrated,
      targetAmbientTempC: migrated.targetAmbientTempC ?? 32.2,
    }
    return migrated
  }, calculationInputObjectSchema)
  .superRefine((value, context) => {
    const ratedCapacityW = capacityToWatts(
      value.ratedCapacity,
      value.capacityUnit,
    )
    if (ratedCapacityW < 20 || ratedCapacityW > 250000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ratedCapacity'],
        message: 'La capacidad debe estar entre 20 y 250000 W equivalentes',
      })
    }
    const displacementCm3Rev = displacementToCubicCentimeters(
      value.displacement,
      value.displacementUnit,
    )
    if (displacementCm3Rev < 0.2 || displacementCm3Rev > 3000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['displacement'],
        message: 'El desplazamiento debe estar entre 0.2 y 3000 cm³/rev equivalentes',
      })
    }
    if (value.targetCondC - value.targetEvapC < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetCondC'],
        message: 'La condensación debe superar la evaporación al menos 8 K',
      })
    }
    if (value.targetReturnGasTempC < value.targetEvapC) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetReturnGasTempC'],
        message: 'El retorno de gas debe ser igual o mayor que la evaporación',
      })
    }
    if (value.refCondC - value.refEvapC < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['refCondC'],
        message: 'La referencia debe tener al menos 8 K de salto',
      })
    }
    const hasDiameter = value.installedDiameterMm !== null
    const hasLength = value.installedLengthM !== null
    if (hasDiameter !== hasLength) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasDiameter ? 'installedLengthM' : 'installedDiameterMm'],
        message: 'Introduce diámetro y longitud del capilar instalado juntos',
      })
    }
  })

export const settingsSchema = z.object({
  appName: z.string().min(2).max(30),
  learningEnabled: z.boolean(),
  autoCalculate: z.boolean(),
  showAdvanced: z.boolean(),
})

const outcomeSchema = z.object({
  diameterMm: z.number().nullable(),
  lengthM: z.number().nullable(),
  measuredEvapC: z.number().nullable(),
  measuredCapacityW: z.number().nullable(),
  modeledLengthAtActualM: z.number().nullable(),
  notes: z.string(),
  recordedAt: z.string(),
})

const resultCoreSchema = z
  .object({
    version: z.string(),
    calculatedAt: z.string(),
    fingerprint: z.string(),
    input: calculationInputSchema,
    capillary: z.object({
      diameterMm: z.number(),
      lengthM: z.number(),
    }).passthrough(),
    compressor: z.object({
      capacityW: z.number(),
      massFlowKgS: z.number(),
      etaVolumetricTarget: z.number(),
    }).passthrough(),
    uncertainty: z.object({
      totalPct: z.number(),
      confidenceScore: z.number(),
    }).passthrough(),
    warnings: z.array(z.unknown()),
  })
  .passthrough()

export const savedCaseSchema = z.object({
  id: z.string().min(3),
  createdAt: z.string(),
  updatedAt: z.string(),
  fingerprint: z.string(),
  result: resultCoreSchema,
  actual: outcomeSchema.nullable(),
  source: z.enum(['calculation', 'demo', 'imported']),
})

const storedStateSchema = z.object({
  version: z.number(),
  settings: settingsSchema,
  cases: z.array(savedCaseSchema),
  lastUpdated: z.string(),
})

export const exportEnvelopeSchema = z.object({
  app: z.literal('CapilarPro'),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  settings: settingsSchema.optional(),
  cases: z.array(savedCaseSchema),
})

export type ParsedCase = z.infer<typeof savedCaseSchema>
export type ParsedStoredState = z.infer<typeof storedStateSchema>

export const parseStoredState = (raw: string) => {
  const parsed = JSON.parse(raw) as unknown
  return storedStateSchema.safeParse(parsed)
}

export const parseImportedCases = (raw: string) => {
  const parsed = JSON.parse(raw) as unknown
  const envelope = exportEnvelopeSchema.safeParse(parsed)
  if (envelope.success) return envelope.data
  const cases = z.array(savedCaseSchema).safeParse(parsed)
  if (cases.success) {
    return {
      app: 'CapilarPro' as const,
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      cases: cases.data,
    }
  }
  return null
}

export const defaultSettings = (): AppSettings => ({
  appName: defaults.defaults.appName,
  learningEnabled: defaults.ui.learningEnabled,
  autoCalculate: defaults.ui.autoCalculate,
  showAdvanced: defaults.ui.showAdvanced,
})

export const defaultInput = (): CalculationInput => {
  const seed = defaults.defaults
  return {
    refrigerantId: seed.refrigerantId as RefrigerantId,
    compressorId: 'custom',
    compressorLabel: '',
    standardId: seed.standardId as StandardId,
    application:
      seed.refEvapC <= -20 ? 'LBP' : seed.refEvapC <= 0 ? 'MBP' : 'HBP',
    ratedCapacity: seed.ratedCapacityW,
    capacityUnit: 'W',
    displacement: seed.displacementCm3Rev,
    displacementUnit: 'cm³/rev',
    frequencyHz: 60,
    refEvapC: seed.refEvapC,
    refCondC: seed.refCondC,
    ambientTempC: 32.2,
    returnGasTempC: 32.2,
    refSuperheatK: 32.2 - seed.refEvapC,
    refSubcoolK: seed.refCondC - 32.2,
    targetEvapC: seed.targetEvapC,
    targetCondC: seed.targetCondC,
    targetReturnGasTempC: seed.targetEvapC + seed.targetSuperheatK,
    targetAmbientTempC: 32.2,
    targetSuperheatK: seed.targetSuperheatK,
    targetSubcoolK: seed.targetSubcoolK,
    slhxActivo: false,
    slhxEfectividad: 0.7,
    installedDiameterMm: null,
    installedLengthM: null,
    notes: '',
  }
}

export const normalizeCase = (value: ParsedCase): SavedCase =>
  value as unknown as SavedCase
