import { describe, expect, it } from 'vitest'
import { defaultInput } from '../store/schemas'
import { calculate } from './calculate'
import type { CalculationResult } from '../types'
import type { SlhxSuctionTubeDiameter } from './slhx'

const withSlhx = (
  windingPercentage: number,
  suctionTubeDiameter: SlhxSuctionTubeDiameter,
): CalculationResult =>
  calculate({
    ...defaultInput(),
    slhxActivo: true,
    slhxPorcentaje: windingPercentage,
    slhxDiametroSuccion: suctionTubeDiameter,
  })

const effectiveness = (result: CalculationResult): number => {
  expect(result.slhx).not.toBeNull()
  return result.slhx?.epsilonReal ?? Number.NaN
}

describe('SLHX acoplado al capilar (integración)', () => {
  it('calcula una efectividad realista, no la de diseño', () => {
    const result = withSlhx(50, '5/16')
    const epsilon = effectiveness(result)

    expect(Number.isFinite(epsilon)).toBe(true)
    expect(epsilon).toBeGreaterThanOrEqual(0.1)
    // Momentum acceleration and inlet loss alter the converged capillary length.
    expect(epsilon).toBeLessThanOrEqual(0.36)
    // El bug de unidades hacía que ε fuese siempre 0.70.
    expect(Math.abs(epsilon - 0.7)).toBeGreaterThan(0.2)
  })

  it('la efectividad aumenta con el enrollado y la longitud convergida', () => {
    const thirty = effectiveness(withSlhx(30, '5/16'))
    const fifty = effectiveness(withSlhx(50, '5/16'))
    const seventy = effectiveness(withSlhx(70, '5/16'))

    expect(fifty).toBeGreaterThan(thirty)
    expect(seventy).toBeGreaterThan(fifty)
    expect(Math.abs(seventy - thirty)).toBeGreaterThan(0.05)
  })

  it('la efectividad depende del diámetro de succión', () => {
    const small = effectiveness(withSlhx(50, '1/4'))
    const medium = effectiveness(withSlhx(50, '5/16'))
    const large = effectiveness(withSlhx(50, '3/8'))

    expect(medium - small).toBeGreaterThan(1e-3)
    expect(large - medium).toBeGreaterThan(1e-3)
  })

  it('mantiene la efectividad entre 0.1 y la efectividad de diseño', () => {
    const diameters: SlhxSuctionTubeDiameter[] = ['1/4', '5/16', '3/8']
    for (const percentage of [30, 50, 70]) {
      for (const diameter of diameters) {
        const epsilon = effectiveness(withSlhx(percentage, diameter))
        expect(epsilon).toBeGreaterThanOrEqual(0.1)
        expect(epsilon).toBeLessThanOrEqual(0.7)
      }
    }
  })

  it('usa la longitud real del capilar para el enrollado', () => {
    const result = withSlhx(30, '5/16')
    const woundLength = result.slhx?.lengthWoundM ?? 0

    // El bug dejaba 0.005 m porque Lreq se hacía 1000× más corta.
    expect(woundLength).toBeGreaterThan(0.02)
    expect(woundLength).toBeLessThanOrEqual(
      result.capillary.lengthM * 0.3 + 1e-9,
    )
  })

  it('requiere mayor longitud con SLHX que sin SLHX para el mismo diámetro y condiciones', () => {
    const withoutSlhx = calculate({
      ...defaultInput(),
      slhxActivo: false,
      slhxPorcentaje: 50,
      slhxDiametroSuccion: '5/16',
    })
    const withSlhx = calculate({
      ...defaultInput(),
      slhxActivo: true,
      slhxPorcentaje: 50,
      slhxDiametroSuccion: '5/16',
    })

    expect(withSlhx.capillary.lengthM).toBeGreaterThan(
      withoutSlhx.capillary.lengthM,
    )
    expect(withSlhx.capillary.lengthM).toBeGreaterThan(0)
    expect(withoutSlhx.capillary.lengthM).toBeGreaterThan(0)
  })

  it('mantiene el diámetro recomendado al activar el SLHX', () => {
    const input = {
      ...defaultInput(),
      slhxPorcentaje: 50,
      slhxDiametroSuccion: '5/16' as const,
    }
    const withoutSlhx = calculate({ ...input, slhxActivo: false })
    const withSlhx = calculate({ ...input, slhxActivo: true })

    expect(withSlhx.capillary.diameterMm).toBe(
      withoutSlhx.capillary.diameterMm,
    )
  })

  it('propaga el estado y la nota del candidato seleccionado', () => {
    const result = withSlhx(50, '5/16')
    const { lengthM, status, note } = result.capillary

    expect(status).toBeDefined()
    expect(note).toBeTruthy()

    if (lengthM >= 0.35 && lengthM <= 4.5) {
      expect(status).toBe('recommended')
    } else {
      expect(['short', 'long']).toContain(status)
      expect(note).toContain('menos desfavorable')
    }
  })
})
