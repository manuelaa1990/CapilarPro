import { describe, expect, it } from 'vitest'
import { solutions } from '../data/catalog'
import { defaultInput } from '../store/schemas'
import type { CalculationInput } from '../types'
import { calculate } from './calculate'

const COMMERCIAL_INCHES = [
  0.026, 0.031, 0.036, 0.042, 0.048, 0.054, 0.064, 0.07, 0.075, 0.08, 0.085,
  0.09, 0.1,
]

const NOW = { now: new Date('2026-10-25T12:00:00.000Z') }

const inputWith = (
  patch: Partial<CalculationInput> = {},
): CalculationInput => ({
  ...defaultInput(),
  ...patch,
})

describe('diámetros comerciales', () => {
  it('cubre de 0.026" a 0.100" con equivalencias en mm', () => {
    expect(solutions.capillaryIdsMm).toHaveLength(COMMERCIAL_INCHES.length)
    solutions.capillaryIdsMm.forEach((mm, index) => {
      expect(mm).toBeCloseTo(COMMERCIAL_INCHES[index] * 25.4, 2)
    })
  })

  it('solo selecciona diámetros de la lista comercial', () => {
    const result = calculate(inputWith(), NOW)

    expect(solutions.capillaryIdsMm).toContain(result.capillary.diameterMm)
    for (const alternative of result.capillary.alternatives) {
      expect(solutions.capillaryIdsMm).toContain(alternative.diameterMm)
    }
  })

  it('sube a medidas de alto caudal cuando la capacidad lo exige', () => {
    const high = calculate(
      inputWith({ ratedCapacity: 12000, displacement: 45 }),
      NOW,
    )
    const veryHigh = calculate(
      inputWith({ ratedCapacity: 20000, displacement: 70 }),
      NOW,
    )

    // 0.090" y 0.100" respectivamente, por encima del antiguo tope de 0.064".
    expect(high.capillary.diameterMm).toBe(2.286)
    expect(veryHigh.capillary.diameterMm).toBe(2.54)
    expect(high.capillary.diameterMm).toBeGreaterThan(1.626)
  })
})
