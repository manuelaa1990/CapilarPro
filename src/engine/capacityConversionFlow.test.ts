import { describe, expect, it } from 'vitest'
import { defaultInput } from '../store/schemas'
import type {
  CalculationInput,
  CalculationResult,
  CompressorApplication,
} from '../types'
import { calculate } from './calculate'
import { getStandardConditions } from './standards'

const NOW = { now: new Date('2026-10-25T12:00:00.000Z') }

/** Condiciones de referencia de placa para un régimen (condición de diseño). */
const referenceFor = (application: CompressorApplication) => {
  const conditions = getStandardConditions(application, 'ASHRAE')
  if (!conditions) throw new Error(`Sin condiciones para ${application}`)
  return {
    refEvapC: conditions.tEvapRef,
    refCondC: conditions.tCondRef,
    ambientTempC: conditions.ambientTempC,
    returnGasTempC: conditions.returnGasTempC,
    refSuperheatK: conditions.shRef,
    refSubcoolK: conditions.scRef,
  }
}

/** Condiciones objetivo para un régimen (condición requerida). */
const targetFor = (application: CompressorApplication) => {
  const conditions = getStandardConditions(application, 'ASHRAE')
  if (!conditions) throw new Error(`Sin condiciones para ${application}`)
  return {
    targetEvapC: conditions.tEvapRef,
    targetCondC: conditions.tCondRef,
    targetAmbientTempC: conditions.ambientTempC,
    targetReturnGasTempC: conditions.returnGasTempC,
    targetSuperheatK: conditions.shRef,
    targetSubcoolK: conditions.scRef,
  }
}

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
      inputWith({
        application: 'MBP',
        declaredApplication: 'MBP',
        ...referenceFor('MBP'),
        ...targetFor('MBP'),
      }),
      NOW,
    )
    const converted = calculate(
      inputWith({
        application: 'MBP',
        declaredApplication: 'LBP',
        ...referenceFor('LBP'),
        ...targetFor('MBP'),
      }),
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

  it('aumenta el caudal y reoptimiza el capilar a la condición requerida', () => {
    const base = calculate(
      inputWith({
        application: 'MBP',
        declaredApplication: 'MBP',
        ...referenceFor('MBP'),
        ...targetFor('MBP'),
      }),
      NOW,
    )
    const converted = calculate(
      inputWith({
        application: 'MBP',
        declaredApplication: 'LBP',
        ...referenceFor('LBP'),
        ...targetFor('MBP'),
      }),
      NOW,
    )

    expect(converted.compressor.massFlowKgS).toBeGreaterThan(
      base.compressor.massFlowKgS,
    )
    // El ranking puede elegir un diámetro menor: comprueba la longitud a un
    // diámetro común en vez de asumir que el diámetro recomendado es monótono.
    const sameDiameterLength = lengthForDiameter(
      converted,
      base.capillary.diameterMm,
    )
    expect(sameDiameterLength).toBeDefined()
    expect(sameDiameterLength!).toBeLessThan(base.capillary.lengthM)
  })

  it('al subir la capacidad declarada también crece el caudal y reoptimiza el capilar', () => {
    const base = calculate(
      inputWith({
        application: 'MBP',
        declaredApplication: 'MBP',
        ...referenceFor('MBP'),
        ...targetFor('MBP'),
      }),
      NOW,
    )
    const higher = calculate(
      inputWith({
        application: 'MBP',
        declaredApplication: 'MBP',
        ratedCapacity: 2600,
        ...referenceFor('MBP'),
        ...targetFor('MBP'),
      }),
      NOW,
    )

    expect(higher.compressor.massFlowKgS).toBeGreaterThan(
      base.compressor.massFlowKgS,
    )
    const sameDiameterLength = lengthForDiameter(
      higher,
      base.capillary.diameterMm,
    )
    expect(sameDiameterLength).toBeDefined()
    expect(sameDiameterLength!).toBeLessThan(base.capillary.lengthM)
  })
})
