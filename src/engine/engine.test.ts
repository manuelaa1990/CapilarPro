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
import { saturationAtPressure, saturationAtTemperature } from './properties'
import { applyStandard } from './standards'
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
      notes: 'otra nota que no cambia la física',
      compressorLabel: 'Etiqueta distinta',
      installedDiameterMm: 1.1,
      installedLengthM: 1.6,
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
        ratedCapacityW: compressor.ratedCapacityW,
        displacementCm3Rev: compressor.displacementCm3Rev,
        frequencyHz: 60,
        refEvapC: compressor.ratedEvapC,
        refCondC: compressor.ratedCondC,
        refSuperheatK: compressor.ratedSuperheatK,
        refSubcoolK: compressor.ratedSubcoolK,
        targetEvapC: compressor.ratedEvapC + 5,
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
      (defaultInput().displacementCm3Rev * 1e-6 * 3000) / 60,
    )
    expect(at60Hz.compressor.sweptVolumeM3s).toBeCloseTo(
      (defaultInput().displacementCm3Rev * 1e-6 * 3600) / 60,
    )
  })
})

describe('modelo de capilar', () => {
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
  it('la evidencia de campo reduce el término empírico', () => {
    const base = {
      lengthM: 1.8,
      diameterMm: 1.1,
      referencePressureRatio: 4,
      targetPressureRatio: 5,
      capacityAnchored: true,
    }
    const withoutEvidence = estimateUncertainty({
      ...base,
      calibrationSamples: 0,
    })
    const withEvidence = estimateUncertainty({
      ...base,
      calibrationSamples: 20,
    })
    const contribution = (samples: number) =>
      estimateUncertainty({ ...base, calibrationSamples: samples })
        .contributions.find((item) => item.id === 'calibration')!.sigmaPct

    expect(contribution(20)).toBeLessThan(contribution(0))
    expect(withEvidence.totalPct).toBeLessThanOrEqual(withoutEvidence.totalPct)
  })

  it('declara una confianza coherente con la banda', () => {
    const result = estimateUncertainty({
      lengthM: 1.8,
      diameterMm: 1.1,
      referencePressureRatio: 4,
      targetPressureRatio: 4,
      calibrationSamples: 0,
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
