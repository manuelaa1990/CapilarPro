import { describe, expect, it } from 'vitest'
import { defaultInput } from '../store/schemas'
import { compressorById, refrigerants } from '../data/catalog'
import type { CalculationInput } from '../types'
import { calculate } from './calculate'
import {
  predictLengthForDiameter,
  simulateCapillaryLength,
} from './capillary'
import { fingerprintOf } from './fingerprint'
import {
  fluidLimits,
  saturationAtPressure,
  saturationSpecificVolumeDerivativesAtPressure,
  saturationAtTemperature,
} from './properties'
import { applyStandard, getStandardConditions } from './standards'
import { estimateUncertainty } from './uncertainty'
import { anchorVolumetricEfficiency } from './volumetricEfficiency'

const calculateWith = (patch: Partial<CalculationInput> = {}) => {
  const input = { ...defaultInput(), ...patch }
  return calculate(input, { now: new Date('2026-10-25T12:00:00.000Z') })
}

describe('fingerprint', () => {
  it('es estable y solo depende de los datos físicos', () => {
    const base = defaultInput()
    const first = fingerprintOf(base)
    const second = fingerprintOf({
      ...base,
      compressorLabel: 'Etiqueta distinta',
    })
    expect(first).toBe(second)
    expect(first).toMatch(/^CP-[0-9A-F]{8}$/)
  })

  it('cambia cuando cambia una condición de diseño', () => {
    const base = defaultInput()
    expect(fingerprintOf({ ...base, targetCondC: 46 })).not.toBe(
      fingerprintOf(base),
    )
  })

  it('cambia cuando cambia la configuración del SLHX', () => {
    const base = defaultInput()
    expect(fingerprintOf({ ...base, slhxActivo: true })).not.toBe(
      fingerprintOf(base),
    )
    expect(
      fingerprintOf({
        ...base,
        slhxActivo: true,
        slhxPorcentaje: 60,
      }),
    ).not.toBe(fingerprintOf({ ...base, slhxActivo: true }))
    expect(
      fingerprintOf({
        ...base,
        slhxActivo: true,
        slhxDiametroSuccion: '1/4',
      }),
    ).not.toBe(fingerprintOf({ ...base, slhxActivo: true }))
  })
})

describe('eficiencia volumétrica anclada', () => {
  it('reproduce la eficiencia de referencia cuando el punto no cambia', () => {
    const result = anchorVolumetricEfficiency({
      measuredEtaRef: 0.72,
      referencePressureRatio: 4.2,
      targetPressureRatio: 4.2,
    })
    expect(result.etaTarget).toBeCloseTo(result.etaRef, 8)
    expect(result.anchored).toBe(true)
  })

  it('reduce la eficiencia al aumentar la relación de presiones', () => {
    const result = anchorVolumetricEfficiency({
      measuredEtaRef: 0.72,
      referencePressureRatio: 3.2,
      targetPressureRatio: 6.4,
    })
    expect(result.etaTarget).toBeLessThan(result.etaRef)
    expect(result.clearanceRatio).toBeGreaterThan(0)
  })

  it('marca como no anclada una eficiencia fuera del rango físico', () => {
    const result = anchorVolumetricEfficiency({
      measuredEtaRef: 1.4,
      referencePressureRatio: 3.2,
      targetPressureRatio: 3.2,
    })
    expect(result.anchored).toBe(false)
    expect(result.etaRef).toBeLessThanOrEqual(0.95)
  })
})

describe('propiedades termofísicas', () => {
  it('calcula derivadas analíticas negativas del volumen saturado', () => {
    const pressureKPa = saturationAtTemperature('R134a', 25).pressureKPa
    const derivatives = saturationSpecificVolumeDerivativesAtPressure(
      'R134a',
      pressureKPa,
    )

    expect(derivatives).not.toBeNull()
    expect(Number.isFinite(derivatives!.liquidM3KgPerPa)).toBe(true)
    expect(derivatives!.vaporM3KgPerPa).toBeLessThan(0)
  })

  it('interpola saturación para los seis refrigerantes', () => {
    for (const refrigerant of refrigerants) {
      const saturation = saturationAtTemperature(refrigerant.id, 25)
      expect(saturation.pressureKPa).toBeGreaterThan(0)
      expect(saturation.vaporDensity).toBeLessThan(
        saturation.liquidDensity,
      )
      expect(saturation.latentHeatKJkg).toBeGreaterThan(0)
    }
  })

  it('mantiene la presión monotónica con la temperatura', () => {
    const low = saturationAtTemperature('R134a', -10)
    const high = saturationAtTemperature('R134a', 40)
    expect(high.pressureKPa).toBeGreaterThan(low.pressureKPa)
  })

  it('devuelve la misma temperatura al invertir presión y saturación', () => {
    const saturation = saturationAtTemperature('R290', 5)
    const fromPressure = saturationAtPressure(
      'R290',
      saturation.pressureKPa,
    )
    expect(fromPressure.temperatureC).toBeCloseTo(5, 6)
  })
})

describe('cálculo completo', () => {
  it('produce un capilar viable con incertidumbre declarada', () => {
    const result = calculateWith()

    expect(result.compressor.etaVolumetricRef).toBeGreaterThan(0)
    expect(result.compressor.etaVolumetricRef).toBeLessThanOrEqual(0.95)
    expect(result.compressor.massFlowKgS).toBeGreaterThan(0)
    expect(result.compressor.capacityW).toBeGreaterThan(0)
    expect(result.capillary.diameterMm).toBeGreaterThanOrEqual(0.5)
    expect(result.capillary.lengthM).toBeGreaterThan(0)
    expect(result.capillary.alternatives.length).toBeGreaterThan(0)
    expect(result.uncertainty.totalPct).toBeGreaterThanOrEqual(5)
    expect(result.uncertainty.totalPct).toBeLessThanOrEqual(45)
    expect(result.uncertainty.interval.lengthM[0]).toBeLessThan(
      result.capillary.lengthM,
    )
    expect(result.uncertainty.interval.lengthM[1]).toBeGreaterThan(
      result.capillary.lengthM,
    )
    expect(result.fingerprint).toMatch(/^CP-/)
    expect(
      result.warnings.some((warning) => warning.code === 'eta-outlier'),
    ).toBe(!result.compressor.anchored)
  })

  it('es determinista para la misma entrada y el mismo instante', () => {
    const first = calculateWith()
    const second = calculateWith()
    expect(second.capillary).toEqual(first.capillary)
    expect(second.uncertainty).toEqual(first.uncertainty)
  })

  it('calcula el SH operativo desde la temperatura de retorno de gas', () => {
    const result = calculateWith({
      targetEvapC: -10,
      targetReturnGasTempC: 2,
      targetSuperheatK: 40,
    })
    expect(result.input.targetSuperheatK).toBe(12)
  })

  it('recalcula el caudal y el capilar con el intercambiador SLHX activo', () => {
    const withoutSlhx = calculateWith()
    const withSlhx = calculateWith({ slhxActivo: true })

    expect(withSlhx.input.slhxActivo).toBe(true)
    expect(withSlhx.slhx?.epsilonReal).toBeGreaterThan(0)
    expect(withSlhx.slhx?.lengthWoundM).toBeLessThanOrEqual(
      withSlhx.capillary.lengthM * 0.5,
    )
    expect(withSlhx.compressor.suctionEnthalpy).toBeGreaterThan(
      withoutSlhx.compressor.suctionEnthalpy,
    )
    expect(withSlhx.compressor.liquidEnthalpy).toBeLessThan(
      withoutSlhx.compressor.liquidEnthalpy,
    )
    expect(withSlhx.compressor.massFlowKgS).not.toBeCloseTo(
      withoutSlhx.compressor.massFlowKgS,
      6,
    )
    expect(withSlhx.capillary.lengthM).not.toBeCloseTo(
      withoutSlhx.capillary.lengthM,
      6,
    )
  })

  it('rechaza un salto térmico insuficiente', () => {
    expect(() => calculateWith({ targetCondC: 1 })).toThrow(/8 K/)
  })

  it('calcula con compresores de la biblioteca y sus refrigerantes', () => {
    const samples = [
      'secop-sc15g',
      'embraco-em2x1107u',
      'copeland-zb15kqe',
      'embraco-nj9232e',
    ]

    for (const id of samples) {
      const compressor = compressorById(id)
      expect(compressor).toBeDefined()
      if (!compressor) continue
      const result = calculateWith({
        compressorId: compressor.id,
        compressorLabel: `${compressor.brand} ${compressor.model}`,
        refrigerantId: compressor.refrigerants[0],
        standardId: compressor.standardId,
        ratedCapacity: compressor.ratedCapacityW,
        capacityUnit: 'W',
        displacement: compressor.displacementCm3Rev,
        displacementUnit: 'cm³/rev',
        frequencyHz: 60,
        refEvapC: compressor.ratedEvapC,
        refCondC: compressor.ratedCondC,
        refSuperheatK: compressor.ratedSuperheatK,
        refSubcoolK: compressor.ratedSubcoolK,
        targetEvapC: compressor.ratedEvapC + 5,
        targetReturnGasTempC: compressor.ratedEvapC + 15,
        targetCondC: 42,
      })
      expect(Number.isFinite(result.capillary.lengthM)).toBe(true)
      expect(result.capillary.diameterMm).toBeGreaterThan(0)
    }
  })
})

describe('frecuencia de red', () => {
  it('calcula las RPM y el volumen barrido para compresores de 2 polos', () => {
    const at50Hz = calculateWith({ frequencyHz: 50 })
    const at60Hz = calculateWith({ frequencyHz: 60 })

    expect(at50Hz.compressor.sweptVolumeM3s).toBeCloseTo(
      (defaultInput().displacement * 1e-6 * 3000) / 60,
    )
    expect(at60Hz.compressor.sweptVolumeM3s).toBeCloseTo(
      (defaultInput().displacement * 1e-6 * 3600) / 60,
    )
  })
})

describe('conversiones de unidades', () => {
  it('produce el mismo cálculo desde W/cm³ y BTU/h/in³', () => {
    const metricInput = {
      ...defaultInput(),
      ratedCapacity: 1300,
      capacityUnit: 'W' as const,
      displacement: 15.3,
      displacementUnit: 'cm³/rev' as const,
    }
    const imperialInput = {
      ...metricInput,
      ratedCapacity: 1300 * 3.412,
      capacityUnit: 'BTU/h' as const,
      displacement: 15.3 / 16.387,
      displacementUnit: 'in³/rev' as const,
    }

    const metric = calculate(metricInput)
    const imperial = calculate(imperialInput)
    expect(imperial.compressor.sweptVolumeM3s).toBeCloseTo(
      metric.compressor.sweptVolumeM3s,
      10,
    )
    expect(imperial.compressor.rawEtaVolumetricRef).toBeCloseTo(
      metric.compressor.rawEtaVolumetricRef,
      10,
    )
    expect(imperial.capillary.lengthM).toBeCloseTo(metric.capillary.lengthM, 8)
  })
})

describe('refrigerantes zeotrópicos', () => {
  it('separa presión de rocío y burbuja para los cuatro sustitutos incluidos', () => {
    for (const refrigerantId of ['R407C', 'R417A', 'R422D', 'R427A'] as const) {
      const bubble = saturationAtTemperature(refrigerantId, 25, 'bubble')
      const dew = saturationAtTemperature(refrigerantId, 25, 'dew')
      expect(bubble.pressureKPa).toBeGreaterThan(dew.pressureKPa)
      expect(
        saturationAtPressure(
          refrigerantId,
          bubble.pressureKPa,
          'bubble',
        ).temperatureC,
      ).toBeCloseTo(25, 3)
      expect(
        saturationAtPressure(refrigerantId, dew.pressureKPa, 'dew')
          .temperatureC,
      ).toBeCloseTo(25, 3)
    }
  })

  it('calcula el punto objetivo con cada mezcla zeotrópica incluida', () => {
    for (const refrigerantId of ['R407C', 'R417A', 'R422D', 'R427A'] as const) {
      const result = calculateWith({ refrigerantId })
      expect(Number.isFinite(result.compressor.targetPressureRatio)).toBe(true)
      expect(Number.isFinite(result.capillary.lengthM)).toBe(true)
      expect(result.capillary.lengthM).toBeGreaterThan(0)
    }
    expect(fluidLimits('R427A').minDesignEvapC).toBeGreaterThan(-40)
  })
})

describe('modelo de capilar', () => {
  it('aplica la pérdida de entrada antes de integrar la longitud', () => {
    const pressureInKPa = saturationAtTemperature('R134a', 45).pressureKPa
    const simulation = simulateCapillaryLength(1, {
      fluid: 'R134a',
      pressureInKPa,
      pressureOutKPa: pressureInKPa - 2,
      subcoolK: 5,
      massFlowKgS: 0.005,
    })

    expect(simulation).toBeNull()
  })

  it('detiene la integración al alcanzar el criterio sónico de momentum', () => {
    const pressureInKPa = saturationAtTemperature('R134a', 45).pressureKPa
    const pressureOutKPa = saturationAtTemperature('R134a', -5).pressureKPa
    const subsonic = simulateCapillaryLength(1, {
      fluid: 'R134a',
      pressureInKPa,
      pressureOutKPa,
      subcoolK: 5,
      massFlowKgS: 0.0005,
    })
    const simulation = simulateCapillaryLength(1, {
      fluid: 'R134a',
      pressureInKPa,
      pressureOutKPa,
      subcoolK: 5,
      massFlowKgS: 0.003,
    })

    expect(subsonic).not.toBeNull()
    expect(subsonic!.choked).toBe(false)
    expect(simulation).not.toBeNull()
    expect(simulation!.choked).toBe(true)
    expect(simulation!.outletPressureKPa).toBeGreaterThan(pressureOutKPa)
  })

  it('predice una longitud mayor al aumentar el diámetro', () => {
    const result = calculateWith()
    const highPressure = saturationAtTemperature('R134a', 45).pressureKPa
    const lowPressure = saturationAtTemperature('R134a', -5).pressureKPa
    const operating = {
      fluid: 'R134a' as const,
      pressureInKPa: highPressure,
      pressureOutKPa: lowPressure,
      subcoolK: 5,
      massFlowKgS: result.compressor.massFlowKgS,
    }
    const narrow = simulateCapillaryLength(0.7, operating)
    const wide = simulateCapillaryLength(1.1, operating)

    expect(narrow).not.toBeNull()
    expect(wide).not.toBeNull()
    expect(wide!.lengthM).toBeGreaterThan(narrow!.lengthM)
    expect(wide!.massFluxKgM2s).toBeLessThan(narrow!.massFluxKgM2s)
  })

  it('la predicción por diámetro coincide con el simulador', () => {
    const input = defaultInput()
    const result = calculateWith()
    const highPressure = saturationAtTemperature('R134a', 45).pressureKPa
    const lowPressure = saturationAtTemperature('R134a', -5).pressureKPa
    const predicted = predictLengthForDiameter(
      input,
      result.compressor.massFlowKgS,
      highPressure,
      lowPressure,
      1.1,
    )
    expect(predicted).not.toBeNull()
    expect(predicted!).toBeGreaterThan(0)
  })
})

describe('incertidumbre', () => {
  it('mantiene fijo el margen empírico sin muestras de uso', () => {
    const base = {
      lengthM: 1.8,
      diameterMm: 1.1,
      referencePressureRatio: 4,
      targetPressureRatio: 5,
      capacityAnchored: true,
    }
    const result = estimateUncertainty(base)
    expect(
      result.contributions.find((item) => item.id === 'empirical-model')?.sigmaPct,
    ).toBe(6.5)
  })

  it('declara una confianza coherente con la banda', () => {
    const result = estimateUncertainty({
      lengthM: 1.8,
      diameterMm: 1.1,
      referencePressureRatio: 4,
      targetPressureRatio: 4,
      capacityAnchored: true,
    })
    expect(['Alta', 'Buena', 'Moderada', 'Baja']).toContain(
      result.confidenceLabel,
    )
    expect(result.confidenceScore).toBeGreaterThanOrEqual(30)
    expect(result.confidenceScore).toBeLessThanOrEqual(95)
  })
})

describe('normas', () => {
  it('devuelve las condiciones por norma y aplicación', () => {
    expect(getStandardConditions('LBP', 'ASHRAE')).toEqual({
      tEvapRef: -23.3,
      tCondRef: 54.4,
      ambientTempC: 32.2,
      returnGasTempC: 32.2,
      shRef: 55.5,
      scRef: 22.2,
    })
    expect(getStandardConditions('MBP', 'EN 12900')).toEqual({
      tEvapRef: -10,
      tCondRef: 40,
      ambientTempC: 32.2,
      returnGasTempC: 32.2,
      shRef: 42.2,
      scRef: 7.8,
    })
    expect(getStandardConditions('HBP', 'GB/T')).toEqual({
      tEvapRef: 7,
      tCondRef: 55,
      ambientTempC: 32.2,
      returnGasTempC: 32.2,
      shRef: 25.2,
      scRef: 22.8,
    })
    expect(getStandardConditions('HBP', 'Personalizada')).toBeNull()
    expect(getStandardConditions('XYZ', 'ASHRAE')).toBeNull()
  })

  it('aplica las condiciones de una norma no personalizada', () => {
    const current = defaultInput()
    const applied = applyStandard('en12900', current)
    expect(applied.refEvapC).toBe(7.2)
    expect(applied.refCondC).toBe(54.4)
    expect(applied.refSuperheatK).toBe(10)
    expect(applied.refSubcoolK).toBe(0)
  })

  it('no modifica el punto de referencia en modo personalizado', () => {
    const current = { ...defaultInput(), refEvapC: 1.2, refCondC: 40.5 }
    expect(applyStandard('custom', current)).toMatchObject({
      refEvapC: current.refEvapC,
      refCondC: current.refCondC,
      refSuperheatK: current.refSuperheatK,
      refSubcoolK: current.refSubcoolK,
    })
  })
})
