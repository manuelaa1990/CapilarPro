import { describe, expect, it } from 'vitest'
import type { CapillaryCandidate } from '../types'
import { rankCandidates } from './grid'

const candidate = (
  diameterMm: number,
  lengthM: number,
): CapillaryCandidate => ({
  diameterMm,
  lengthM,
  rawLengthM: lengthM,
  massFluxKgM2s: 3000,
  inletVelocityMs: 1.2,
  outletQuality: 0.2,
  outletPressureKPa: 140,
  choked: false,
  status: 'alternative',
  note: '',
})

const options = {
  designLengthM: 1.8,
  minViableLengthM: 0.35,
  maxViableLengthM: 4.5,
}

describe('rankCandidates', () => {
  it('respeta el diámetro preferido cuando sigue en la ventana', () => {
    const ranked = rankCandidates(
      [candidate(0.6, 1.5), candidate(0.7, 3.0)],
      { ...options, preferredDiameterMm: 0.7 },
    )

    expect(ranked[0].diameterMm).toBe(0.7)
    expect(ranked[0].status).toBe('recommended')
  })

  it('ignora la preferencia si ese diámetro sale de la ventana', () => {
    const ranked = rankCandidates(
      [candidate(0.6, 3.2), candidate(0.7, 7.0)],
      { ...options, preferredDiameterMm: 0.7 },
    )

    expect(ranked[0].diameterMm).toBe(0.6)
    expect(ranked[0].lengthM).toBeLessThanOrEqual(options.maxViableLengthM)
    expect(ranked[0].status).toBe('recommended')
  })

  it('no etiqueta como recomendado un candidato fuera de ventana', () => {
    const ranked = rankCandidates(
      [candidate(0.7, 7.0), candidate(0.8, 6.0)],
      { ...options, preferredDiameterMm: 0.7 },
    )

    expect(ranked[0].lengthM).toBeGreaterThan(options.maxViableLengthM)
    expect(ranked[0].status).toBe('long')
    expect(ranked[0].note).toContain('menos desfavorable')
  })
})
