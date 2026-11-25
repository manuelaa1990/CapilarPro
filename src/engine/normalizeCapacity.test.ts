import { describe, expect, it } from 'vitest'
import { refrigerants } from '../data/catalog'
import { defaultInput } from '../store/schemas'
import type { CalculationInput } from '../types'
import { calculate } from './calculate'
import { normalizeCapacity } from './normalizeCapacity'

const inputWith = (
  patch: Partial<CalculationInput> = {},
): CalculationInput => ({
  ...defaultInput(),
  ...patch,
})

const NOW = { now: new Date('2026-10-25T12:00:00.000Z') }

describe('normalización de capacidad', () => {
  it('no convierte cuando la condición declarada coincide con la aplicación', () => {
    const result = normalizeCapacity(
      inputWith({ declaredApplication: 'HBP' }),
      'HBP',
    )

    expect(result.capacityW).toBe(1300)
    expect(result.originalCapacityW).toBe(1300)
    expect(result.declaredApplication).toBe('HBP')
    expect(result.ratioUsed).toBe(1)
    expect(result.method).toBe('none')
    expect(result.warnings).toEqual([])
  })

  it('usa la aplicación actual cuando no se declara condición', () => {
    const input = defaultInput()
    const result = normalizeCapacity(input, input.application)

    expect(result.capacityW).toBe(1300)
    expect(result.ratioUsed).toBe(1)
    expect(result.warnings).toEqual([])
  })

  it('aplica el ratio directo al subir de LBP a HBP', () => {
    const result = normalizeCapacity(
      inputWith({ declaredApplication: 'LBP' }),
      'HBP',
    )

    expect(result.ratioUsed).toBe(2.75)
    expect(result.method).toBe('ratio-table')
    expect(result.originalCapacityW).toBe(1300)
    expect(result.declaredApplication).toBe('LBP')
    expect(result.capacityW).toBeCloseTo(1300 * 2.75, 6)
    expect(result.warnings.map((warning) => warning.code)).toContain(
      'capacity-normalized',
    )
  })

  it('aplica el ratio inverso al bajar de HBP a LBP', () => {
    const result = normalizeCapacity(
      inputWith({ declaredApplication: 'HBP' }),
      'LBP',
    )

    expect(result.ratioUsed).toBeCloseTo(1 / 2.75, 8)
    expect(result.method).toBe('ratio-table')
    expect(result.capacityW).toBeCloseTo(1300 / 2.75, 6)
  })

  it('convierte MBP a HBP y MBP a LBP', () => {
    const toHbp = normalizeCapacity(
      inputWith({ declaredApplication: 'MBP' }),
      'HBP',
    )
    const toLbp = normalizeCapacity(
      inputWith({ declaredApplication: 'MBP' }),
      'LBP',
    )

    expect(toHbp.ratioUsed).toBe(1.3)
    expect(toLbp.ratioUsed).toBeCloseTo(1 / 2.1, 8)
  })

  it('advierte y conserva la capacidad para refrigerantes sin ratios', () => {
    const result = normalizeCapacity(
      inputWith({ refrigerantId: 'R507A', declaredApplication: 'LBP' }),
      'HBP',
    )

    expect(result.capacityW).toBe(1300)
    expect(result.ratioUsed).toBe(1)
    expect(result.method).toBe('none')
    expect(result.warnings[0]).toMatchObject({
      code: 'capacity-normalization-missing',
      severity: 'warning',
    })
  })

  it('responde para todos los refrigerantes del catálogo', () => {
    for (const refrigerant of refrigerants) {
      const result = normalizeCapacity(
        inputWith({
          refrigerantId: refrigerant.id,
          declaredApplication: 'LBP',
        }),
        'HBP',
      )

      expect(Number.isFinite(result.capacityW)).toBe(true)
      expect(result.capacityW).toBeGreaterThan(0)
    }
  })
})

describe('integración con el motor', () => {
  it('ancla la eficiencia con la capacidad normalizada y publica el aviso', () => {
    const base = calculate(inputWith({ declaredApplication: 'HBP' }), NOW)
    const normalized = calculate(
      inputWith({ declaredApplication: 'LBP' }),
      NOW,
    )

    expect(normalized.compressor.rawEtaVolumetricRef).toBeCloseTo(
      base.compressor.rawEtaVolumetricRef * 2.75,
      8,
    )
    expect(
      normalized.warnings.some(
        (warning) => warning.code === 'capacity-normalized',
      ),
    ).toBe(true)
    expect(
      base.warnings.some(
        (warning) => warning.code === 'capacity-normalized',
      ),
    ).toBe(false)
  })
})
