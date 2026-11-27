import { describe, expect, it } from 'vitest'
import { defaultInput } from '../store/schemas'
import type { CalculationInput } from '../types'
import { calculate } from './calculate'
import { saturationAtTemperature, superheatedVaporState } from './properties'
import { pressureRatio } from './volumetricEfficiency'

const NOW = { now: new Date('2026-10-25T12:00:00.000Z') }

const inputWith = (
  patch: Partial<CalculationInput> = {},
): CalculationInput => ({
  ...defaultInput(),
  ...patch,
})

describe('cambio de refrigerante de diseño a requerido', () => {
  it('ancla la ηv en la placa de R22 y resuelve el punto con R134a', () => {
    const design = calculate(
      inputWith({ refrigerantId: 'R22', ratedCapacity: 2600 }),
      NOW,
    )
    const changed = calculate(
      inputWith({
        refrigerantId: 'R22',
        requiredRefrigerantId: 'R134a',
        ratedCapacity: 2600,
      }),
      NOW,
    )

    expect(changed.refrigerantChanged).toBe(true)
    expect(changed.designRefrigerant.id).toBe('R22')
    expect(changed.requiredRefrigerant.id).toBe('R134a')
    expect(changed.capacityNormalization.method).toBe('refrigerant-change')
    expect(changed.capacityNormalization.ratioUsed).toBe(1)
    expect(changed.capacityNormalization.capacityW).toBeCloseTo(
      changed.capacityNormalization.originalCapacityW,
      8,
    )

    // El ancla de placa no cambia: se calcula con R22 y la capacidad declarada.
    expect(changed.compressor.rawEtaVolumetricRef).toBeCloseTo(
      design.compressor.rawEtaVolumetricRef,
      10,
    )
    expect(changed.compressor.etaVolumetricRef).toBeCloseTo(
      design.compressor.etaVolumetricRef,
      10,
    )
    expect(changed.compressor.referencePressureRatio).toBeCloseTo(
      design.compressor.referencePressureRatio,
      10,
    )
    // El punto requerido usa las propiedades de R134a.
    const input = inputWith({
      refrigerantId: 'R22',
      requiredRefrigerantId: 'R134a',
    })
    const targetSaturation = saturationAtTemperature(
      'R134a',
      input.targetEvapC,
      'dew',
    )
    const targetCondSaturation = saturationAtTemperature(
      'R134a',
      input.targetCondC,
      'bubble',
    )
    const targetSuction = superheatedVaporState(
      'R134a',
      targetSaturation.pressureKPa,
      input.targetReturnGasTempC,
    )

    expect(changed.compressor.targetPressureRatio).toBeCloseTo(
      pressureRatio(
        targetCondSaturation.pressureKPa,
        targetSaturation.pressureKPa,
      ),
      8,
    )
    expect(changed.compressor.suctionDensity).toBeCloseTo(
      targetSuction.densityKgM3,
      8,
    )
    expect(changed.compressor.suctionDensity).not.toBeCloseTo(
      design.compressor.suctionDensity,
      6,
    )

    // Caudal y capacidad se recalculan con el fluido requerido.
    expect(changed.compressor.massFlowKgS).toBeCloseTo(
      changed.capacityNormalization.capacityW /
        (changed.compressor.enthalpyDifference * 1000),
      10,
    )
    expect(changed.compressor.etaVolumetricTarget).toBeCloseTo(
      changed.compressor.massFlowKgS /
        (changed.compressor.sweptVolumeM3s *
          changed.compressor.suctionDensity),
      10,
    )
    expect(changed.compressor.capacityW).toBeCloseTo(
      changed.compressor.massFlowKgS *
        changed.compressor.enthalpyDifference *
        1000,
      6,
    )
    expect(changed.compressor.massFlowKgS).not.toBeCloseTo(
      design.compressor.massFlowKgS,
      6,
    )
    expect(changed.compressor.capacityW).toBeCloseTo(
      changed.capacityNormalization.capacityW,
      6,
    )
  })

  it('no aplica el ratio empírico de condición cuando cambia el refrigerante', () => {
    const changed = calculate(
      inputWith({
        refrigerantId: 'R22',
        requiredRefrigerantId: 'R134a',
        declaredApplication: 'LBP',
      }),
      NOW,
    )

    expect(changed.capacityNormalization.method).toBe('refrigerant-change')
    expect(changed.capacityNormalization.ratioUsed).toBe(1)
    expect(changed.capacityNormalization.capacityW).toBe(
      changed.capacityNormalization.originalCapacityW,
    )
    expect(changed.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['refrigerant-change', 'retrofit-lubricant']),
    )
  })

  it('avisa que sin desplazamiento no puede recalcular densidad ni ηv', () => {
    expect(() =>
      calculate(
        inputWith({
          refrigerantId: 'R22',
          requiredRefrigerantId: 'R134a',
          displacement: 0,
        }),
        NOW,
      ),
    ).toThrow(/Sin desplazamiento volumétrico/)
  })
})
