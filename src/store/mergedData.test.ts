import { describe, expect, it } from 'vitest'
import type {
  ActualOutcome,
  CalculationInput,
  SavedCase,
} from '../types'
import { calculate } from '../engine/calculate'
import { defaultInput } from './schemas'
import {
  computeLearnedModel,
  getCalibration,
  getMemorySuggestion,
} from './mergedData'

const NOW = '2026-10-25T12:00:00.000Z'

const makeCase = (
  id: string,
  patch: Partial<CalculationInput> = {},
  actualLength: number | null = 1.15,
  modeledLength = 1,
): SavedCase => {
  const input = { ...defaultInput(), ...patch }
  const result = calculate(input, { now: new Date(NOW) })
  const actual: ActualOutcome | null =
    actualLength === null
      ? null
      : {
          diameterMm: 1.1,
          lengthM: actualLength,
          measuredEvapC: input.targetEvapC,
          measuredCapacityW: null,
          modeledLengthAtActualM: modeledLength,
          notes: 'Banco de pruebas',
          recordedAt: NOW,
        }
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    fingerprint: result.fingerprint,
    result,
    actual,
    source: 'calculation',
  }
}

describe('aprendizaje local', () => {
  it('no ajusta el modelo sin evidencia', () => {
    const calibration = getCalibration([], 'R134a', true)
    expect(calibration.adjusted).toBe(false)
    expect(calibration.factor).toBe(1)
    expect(calibration.samples).toBe(0)
  })

  it('no ajusta con un solo caso validado', () => {
    const calibration = getCalibration([makeCase('one')], 'R134a', true)
    expect(calibration.adjusted).toBe(false)
    expect(calibration.samples).toBe(1)
    expect(calibration.factor).toBe(1)
  })

  it('aplica la mediana logarítmica con contracción al tener dos casos', () => {
    const cases = [makeCase('one'), makeCase('two')]
    const calibration = getCalibration(cases, 'R134a', true)

    expect(calibration.adjusted).toBe(true)
    expect(calibration.scope).toBe('refrigerant')
    expect(calibration.samples).toBe(2)
    expect(calibration.factor).toBeGreaterThan(1)
    expect(calibration.factor).toBeLessThan(1.2)
    expect(calibration.medianDeviationPct).toBeCloseTo(15, 5)
  })

  it('no aprende si el usuario desactiva la memoria', () => {
    const cases = [makeCase('one'), makeCase('two')]
    const calibration = getCalibration(cases, 'R134a', false)
    expect(calibration.adjusted).toBe(false)
    expect(calibration.factor).toBe(1)
  })

  it('usa el ajuste global cuando no hay dos casos del refrigerante', () => {
    const cases = [
      makeCase('one', { refrigerantId: 'R134a' }),
      makeCase('two', { refrigerantId: 'R134a' }),
    ]
    const calibration = getCalibration(cases, 'R290', true)
    expect(calibration.adjusted).toBe(true)
    expect(calibration.scope).toBe('global')
  })

  it('ignora evidencias absurdas fuera de la ventana de corrección', () => {
    const cases = [
      makeCase('one', {}, 3.5, 1),
      makeCase('two', {}, 3.4, 1),
    ]
    const calibration = getCalibration(cases, 'R134a', true)
    expect(calibration.adjusted).toBe(false)
  })
})

describe('modelo aprendido', () => {
  it('resume casos, evidencias y calibración por refrigerante', () => {
    const cases = [
      makeCase('one'),
      makeCase('two'),
      makeCase('three', { refrigerantId: 'R290' }, null),
    ]
    const learned = computeLearnedModel(cases, defaultInput(), true)

    expect(learned.totalCases).toBe(3)
    expect(learned.actualCases).toBe(2)
    expect(learned.calibration.adjusted).toBe(true)
    expect(learned.byRefrigerant.R134a?.samples).toBe(2)
    expect(learned.byRefrigerant.R290).toBeUndefined()
  })

  it('sugiere una recomendación de casos similares del mismo refrigerante', () => {
    const cases = [makeCase('one'), makeCase('two')]
    const suggestion = getMemorySuggestion(cases, defaultInput(), true)

    expect(suggestion).not.toBeNull()
    expect(suggestion!.refrigerantId).toBe('R134a')
    expect(suggestion!.sampleCount).toBe(2)
    expect(suggestion!.diameterMm).toBeGreaterThan(0)
    expect(suggestion!.lengthM).toBeGreaterThan(0)
    expect(suggestion!.similarity).toBeGreaterThan(0.38)
    expect(suggestion!.lastSeen).toBe(NOW)
  })

  it('no sugiere nada para un refrigerante distinto sin historial', () => {
    const cases = [makeCase('one'), makeCase('two')]
    const suggestion = getMemorySuggestion(
      cases,
      { ...defaultInput(), refrigerantId: 'R600a' },
      true,
    )
    expect(suggestion).toBeNull()
  })

  it('incluye el compresor del caso similar y cae a Personalizado sin nombre', () => {
    const named = getMemorySuggestion(
      [makeCase('named', { compressorLabel: 'QD110H' })],
      defaultInput(),
      true,
    )
    expect(named?.compressorModel).toBe('QD110H')

    const catalog = getMemorySuggestion(
      [makeCase('catalog', { compressorId: 'secop-sc15g', compressorLabel: '' })],
      defaultInput(),
      true,
    )
    expect(catalog?.compressorModel).toBe('SC15G')

    const unnamed = getMemorySuggestion(
      [makeCase('unnamed', { compressorLabel: '   ' })],
      defaultInput(),
      true,
    )
    expect(unnamed?.compressorModel).toBe('Personalizado')
  })
})
