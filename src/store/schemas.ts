import { z } from 'zod'
import type {
  AppSettings,
  CalculationInput,
  RefrigerantId,
  SavedCase,
  StandardId,
} from '../types'
import { compressorById, defaults } from '../data/catalog'

const refrigerantEnum = z.enum(['R134a', 'R600a', 'R404A', 'R290', 'R22', 'R507A'])
const standardEnum = z.enum(['ahri540', 'en12900', 'ahri-legacy', 'custom'])

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
    compressorLabel: z.string().min(1).max(160),
    standardId: standardEnum,
    ratedCapacityW: z.number().min(20, 'Capacidad demasiado baja').max(250000),
    displacementCm3Rev: z
      .number()
      .min(0.2, 'Desplazamiento demasiado bajo')
      .max(3000),
    frequencyHz: z.union([z.literal(50), z.literal(60)]),
    refEvapC: z.number().min(-65).max(30),
    refCondC: z.number().min(20).max(67),
    refSuperheatK: z.number().min(0).max(50),
    refSubcoolK: z.number().min(0).max(30),
    targetEvapC: z.number().min(-55).max(20),
    targetCondC: z.number().min(20).max(67),
    targetSuperheatK: z.number().min(0).max(50),
    targetSubcoolK: z.number().min(0).max(30),
    installedDiameterMm: nullablePositive(0.3, 3.5),
    installedLengthM: nullablePositive(0.1, 10),
    notes: z.string().max(1200),
  })

export const calculationInputSchema = z
  .preprocess((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    const input = value as Record<string, unknown>
    if (input.frequencyHz !== undefined || typeof input.rpm !== 'number') {
      return value
    }
    const { rpm, ...legacyInput } = input
    return {
      ...legacyInput,
      frequencyHz: rpm <= 3300 ? 50 : 60,
    }
  }, calculationInputObjectSchema)
  .superRefine((value, context) => {
    if (value.targetCondC - value.targetEvapC < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetCondC'],
        message: 'La condensación debe superar la evaporación al menos 8 K',
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
  const compressor = compressorById(seed.compressorId)
  return {
    refrigerantId: seed.refrigerantId as RefrigerantId,
    compressorId: seed.compressorId,
    compressorLabel: compressor
      ? `${compressor.brand} ${compressor.model}`
      : 'Compresor personalizado',
    standardId: seed.standardId as StandardId,
    ratedCapacityW: seed.ratedCapacityW,
    displacementCm3Rev: seed.displacementCm3Rev,
    frequencyHz: 60,
    refEvapC: seed.refEvapC,
    refCondC: seed.refCondC,
    refSuperheatK: seed.refSuperheatK,
    refSubcoolK: seed.refSubcoolK,
    targetEvapC: seed.targetEvapC,
    targetCondC: seed.targetCondC,
    targetSuperheatK: seed.targetSuperheatK,
    targetSubcoolK: seed.targetSubcoolK,
    installedDiameterMm: null,
    installedLengthM: null,
    notes: '',
  }
}

export const normalizeCase = (value: ParsedCase): SavedCase =>
  value as unknown as SavedCase
