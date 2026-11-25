import { describe, expect, it } from 'vitest'
import { defaultInput } from '../store/schemas'
import type { CalculationInput, CalculationResult } from '../types'
import { calculate } from './calculate'

const NOW = { now: new Date('2026-10-25T12:00:00.000Z') }

const inputWith = (
  patch: Partial<CalculationInput> = {},
): CalculationInput => ({
  ...defaultInput(),
  ...patch,
})

/** Longitud resuelta para un diámetro, sea el elegido o una alternativa. */
const lengthForDiameter = (
  result: CalculationResult,
  diameterMm: number,
): number | undefined =>
  [result.capillary, ...result.capillary.alternatives].find(
    (candidate) => candidate.diameterMm === diameterMm,
  )?.lengthM

describe('conversión LBP -> MBP y caudal', () => {
  it('multiplica la capacidad por el factor directo (> 1), sin invertirlo', () => {
    const base = calculate(
      inputWith({ application: 'MBP', declaredApplication: 'MBP' }),
      NOW,
    )
    const converted = calculate(
      inputWith({ application: 'MBP', declaredApplication: 'LBP' }),
      NOW,
    )
    const normalization = converted.capacityNormalization

    expect(normalization.ratioUsed).toBe(2.1)
    expect(normalization.ratioUsed).toBeGreaterThan(1)
    expect(normalization.ratioUsed).not.toBeCloseTo(1 / 2.1, 6)
    expect(normalization.capacityW).toBeCloseTo(
      normalization.originalCapacityW * 2.1,
      6,
    )
    expect(normalization.capacityW).toBeGreaterThan(
      base.capacityNormalization.capacityW,
    )
  })

  it('aumenta el caudal y recomienda mayor diámetro (o menos longitud al mismo diámetro)', () => {
    const base = calculate(
      inputWith({ application: 'MBP', declaredApplication: 'MBP' }),
      NOW,
    )
    const converted = calculate(
      inputWith({ application: 'MBP', declaredApplication: 'LBP' }),
      NOW,
    )

    expect(converted.compressor.massFlowKgS).toBeGreaterThan(
      base.compressor.massFlowKgS,
    )
    expect(converted.capillary.diameterMm).toBeGreaterThanOrEqual(
      base.capillary.diameterMm,
    )

    // A igual diámetro, más caudal exige menos longitud (no más restricción).
    const sameDiameterLength = lengthForDiameter(
      converted,
      base.capillary.diameterMm,
    )
    expect(sameDiameterLength).toBeDefined()
    expect(sameDiameterLength!).toBeLessThan(base.capillary.lengthM)
  })

  it('al subir la capacidad declarada también crece el caudal y el diámetro', () => {
    const base = calculate(
      inputWith({ application: 'MBP', declaredApplication: 'MBP' }),
      NOW,
    )
    const higher = calculate(
      inputWith({
        application: 'MBP',
        declaredApplication: 'MBP',
        ratedCapacity: 2600,
      }),
      NOW,
    )

    expect(higher.compressor.massFlowKgS).toBeGreaterThan(
      base.compressor.massFlowKgS,
    )
    expect(higher.capillary.diameterMm).toBeGreaterThanOrEqual(
      base.capillary.diameterMm,
    )

    const sameDiameterLength = lengthForDiameter(
      higher,
      base.capillary.diameterMm,
    )
    expect(sameDiameterLength).toBeDefined()
    expect(sameDiameterLength!).toBeLessThan(base.capillary.lengthM)
  })
})
