import { describe, expect, it } from 'vitest'
import { calculateSlhxTransfer, slhxSuctionTubeOptions } from './slhx'

describe('modelo de transferencia SLHX', () => {
  it('limita la longitud enrollada al porcentaje del capilar', () => {
    const result = calculateSlhxTransfer({
      massFlowKgS: 0.001,
      gasSpecificHeatJKgK: 850,
      inletTemperatureDifferenceK: 20,
      totalCapillaryLengthM: 0.5,
      windingPercentage: 50,
      suctionTubeDiameter: '5/16',
    })

    expect(result.lengthWoundM).toBeLessThanOrEqual(0.25)
    expect(result.epsilonReal).toBeGreaterThan(0)
    expect(result.epsilonReal).toBeLessThan(0.7)
    expect(result.uWm2K).toBe(38)
  })

  it('alcanza la efectividad de diseño cuando la longitud disponible basta', () => {
    const result = calculateSlhxTransfer({
      massFlowKgS: 0.001,
      gasSpecificHeatJKgK: 850,
      inletTemperatureDifferenceK: 20,
      totalCapillaryLengthM: 10,
      windingPercentage: 70,
      suctionTubeDiameter: '5/16',
    })

    expect(result.epsilonReal).toBeCloseTo(0.7, 10)
    expect(result.lengthWoundM).toBeLessThan(7)
  })

  it('usa la tabla de U configurable para todas las medidas comerciales', () => {
    expect(slhxSuctionTubeOptions.map(({ label, uWm2K }) => [label, uWm2K]))
      .toEqual([
        ['1/4"', 45],
        ['5/16"', 38],
        ['3/8"', 32],
        ['1/2"', 25],
        ['5/8"', 20],
        ['3/4"', 16],
        ['7/8"', 13],
      ])
  })
})
