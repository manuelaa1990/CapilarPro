import { z } from 'zod'
import type {
  CalculationInput,
  RefrigerantId,
  StandardId,
} from '../types'
import { defaults } from '../data/catalog'
import {
  capacityToWatts,
  displacementToCubicCentimeters,
} from '../engine/units'
import { slhxSuctionTubeDiameters } from '../engine/slhx'

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

/** Límites compartidos por el formulario y la validación del cálculo. */
export const inputLimits = {
  targetSubcoolK: { min: 0, max: 30 },
  notesMaxLength: 1200,
  installedDiameterMm: { min: 0.3, max: 3.5 },
  installedLengthM: { min: 0.1, max: 10 },
} as const

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
    targetSubcoolK: z
      .number()
      .min(inputLimits.targetSubcoolK.min)
      .max(inputLimits.targetSubcoolK.max),
    slhxActivo: z.boolean(),
    slhxPorcentaje: z.number().min(30).max(70),
    slhxDiametroSuccion: z.enum(slhxSuctionTubeDiameters),
    installedDiameterMm: nullablePositive(
      inputLimits.installedDiameterMm.min,
      inputLimits.installedDiameterMm.max,
    ),
    installedLengthM: nullablePositive(
      inputLimits.installedLengthM.min,
      inputLimits.installedLengthM.max,
    ),
    notes: z.string().max(inputLimits.notesMaxLength),
  })

export const calculationInputSchema = calculationInputObjectSchema.superRefine((value, context) => {
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
    slhxPorcentaje: 50,
    slhxDiametroSuccion: '5/16',
    installedDiameterMm: null,
    installedLengthM: null,
    notes: '',
  }
}
