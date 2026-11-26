import { describe, expect, it } from 'vitest'
import { refrigerants } from '../data/catalog'
import { defaultInput } from '../store/schemas'
import type { CalculationInput } from '../types'
import { calculate } from './calculate'
import { normalizeCapacity } from './normalizeCapacity'
import { getStandardConditions } from './standards'

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
    const input = { ...defaultInput(), declaredApplication: undefined }
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

  it('convierte de diseño MBP a requerida LBP con el factor inverso', () => {
    const result = normalizeCapacity(
      inputWith({ declaredApplication: 'MBP' }),
      'LBP',
    )

    expect(result.method).toBe('ratio-table')
    expect(result.ratioUsed).toBeCloseTo(1 / 2.1, 8)
    expect(result.ratioUsed).toBeLessThan(1)
    expect(result.capacityW).toBeCloseTo(1300 / 2.1, 6)
  })

  it('convierte de diseño LBP a requerida MBP con el factor directo', () => {
    const result = normalizeCapacity(
      inputWith({ declaredApplication: 'LBP' }),
      'MBP',
    )

    expect(result.method).toBe('ratio-table')
    expect(result.ratioUsed).toBeCloseTo(2.1, 8)
    expect(result.ratioUsed).toBeGreaterThan(1)
    expect(result.capacityW).toBeCloseTo(1300 * 2.1, 6)
  })

  it('convierte CBP con propiedades del refrigerante, sin factor empírico', () => {
    const toHbp = normalizeCapacity(
      inputWith({ declaredApplication: 'CBP' }),
      'HBP',
    )
    const toCbp = normalizeCapacity(
      inputWith({ declaredApplication: 'HBP' }),
      'CBP',
    )
    const toMbp = normalizeCapacity(
      inputWith({ declaredApplication: 'CBP' }),
      'MBP',
    )

    expect(toHbp.method).toBe('physics')
    expect(toCbp.method).toBe('physics')
    expect(toHbp.ratioUsed).toBeGreaterThan(1)
    expect(toHbp.ratioUsed).toBeLessThan(1.5)
    expect(toCbp.ratioUsed).toBeCloseTo(1 / toHbp.ratioUsed, 8)
    expect(toMbp.ratioUsed).toBeLessThan(1)
    expect(toHbp.capacityW).toBeCloseTo(
      toHbp.originalCapacityW * toHbp.ratioUsed,
      6,
    )
    expect(
      toHbp.warnings.map((warning) => warning.code),
    ).toContain('capacity-normalized')
    expect(
      toHbp.warnings.find(
        (warning) => warning.code === 'capacity-normalized',
      )?.message,
    ).toMatch(/sin factor empírico/i)
    expect(
      toHbp.warnings.some(
        (warning) => warning.code === 'capacity-normalization-missing',
      ),
    ).toBe(false)
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
  it('ancla la eficiencia en la capacidad original de placa y publica el aviso', () => {
    const base = calculate(inputWith({ declaredApplication: 'HBP' }), NOW)
    const normalized = calculate(
      inputWith({ declaredApplication: 'LBP' }),
      NOW,
    )

    // La conversión de placa es solo una referencia: el ancla de ηv usa la
    // capacidad declarada original en el punto de diseño, sin escalarla.
    expect(normalized.compressor.rawEtaVolumetricRef).toBeCloseTo(
      base.compressor.rawEtaVolumetricRef,
      8,
    )
    expect(normalized.capacityNormalization.capacityW).toBeCloseTo(
      normalized.capacityNormalization.originalCapacityW * 2.75,
      6,
    )
    expect(normalized.capacityNormalization).toMatchObject({
      declaredApplication: 'LBP',
      originalCapacityW: 1300,
      ratioUsed: 2.75,
    })
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

  it('integra CBP en el motor con la referencia estándar alineada', () => {
    const cbp = getStandardConditions('CBP', 'ASHRAE')
    if (!cbp) throw new Error('CBP sin condiciones estándar')
    const reference = {
      refEvapC: cbp.tEvapRef,
      refCondC: cbp.tCondRef,
      ambientTempC: cbp.ambientTempC,
      returnGasTempC: cbp.returnGasTempC,
      refSuperheatK: cbp.shRef,
      refSubcoolK: cbp.scRef,
    }
    const base = calculate(
      inputWith({
        application: 'CBP',
        declaredApplication: 'CBP',
        ...reference,
      }),
      NOW,
    )
    const converted = calculate(
      inputWith({
        application: 'CBP',
        declaredApplication: 'HBP',
        ...reference,
      }),
      NOW,
    )

    expect(base.capacityNormalization.method).toBe('none')
    expect(converted.capacityNormalization.method).toBe('physics')
    expect(converted.capacityNormalization.ratioUsed).toBeLessThan(1)
    expect(converted.capacityNormalization.capacityW).toBeLessThan(
      converted.capacityNormalization.originalCapacityW,
    )
    expect(converted.compressor.etaVolumetricRef).toBeGreaterThan(0)
    expect(converted.compressor.capacityW).toBeGreaterThan(0)
  })
})
