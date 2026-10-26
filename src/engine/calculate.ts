import { appMeta, refrigerantById, standardById } from '../data/catalog'
import type {
  CalculationInput,
  CalculationResult,
  CalculationWarning,
  CalibrationSummary,
} from '../types'
import { computeCapillary } from './capillary'
import { fingerprintOf } from './fingerprint'
import {
  saturationAtPressure,
  saturationAtTemperature,
  subcooledLiquidState,
  superheatedVaporState,
} from './properties'
import { standardDeviation } from './standards'
import { estimateUncertainty } from './uncertainty'
import {
  anchorVolumetricEfficiency,
  pressureRatio,
} from './volumetricEfficiency'
import { rpmFromFrequency } from './frequency'

interface CalculateOptions {
  calibration?: CalibrationSummary | null
  now?: Date
}

const asSaturationPoint = (
  saturation: ReturnType<typeof saturationAtTemperature>,
) => ({
  temperatureC: saturation.temperatureC,
  pressureKPa: saturation.pressureKPa,
  liquidDensity: saturation.liquidDensity,
  vaporDensity: saturation.vaporDensity,
  latentHeatKJkg: saturation.latentHeatKJkg,
  liquidEnthalpyKJkg: saturation.liquidEnthalpyKJkg,
  vaporEnthalpyKJkg: saturation.vaporEnthalpyKJkg,
  glideK: saturation.glideK,
})

const warningsFor = (
  input: CalculationInput,
  result: Omit<CalculationResult, 'warnings'>,
): CalculationWarning[] => {
  const warnings: CalculationWarning[] = []
  const standard = result.standard
  const deviation = standardDeviation(input, standard)
  const ratioJump = Math.abs(
    Math.log(result.compressor.targetPressureRatio) -
      Math.log(result.compressor.referencePressureRatio),
  )

  if (deviation > 2.5) {
    warnings.push({
      code: 'reference-modified',
      severity: 'info',
      title: 'Condiciones de placa modificadas',
      message: `Los datos de referencia se separan ${deviation.toFixed(1)} puntos de la norma ${standard.shortName}. El anclaje usa la placa, no la norma.`,
    })
  }

  if (!result.compressor.anchored) {
    warnings.push({
      code: 'eta-outlier',
      severity: 'warning',
      title: 'Eficiencia volumétrica atípica',
      message: `La placa implica ηv = ${(result.compressor.rawEtaVolumetricRef * 100).toFixed(1)} %. Se limitó a un rango físico. Verifica desplazamiento, RPM y capacidad.`,
    })
  }

  if (result.compressor.targetPressureRatio > 10) {
    warnings.push({
      code: 'high-pressure-ratio',
      severity: 'warning',
      title: 'Relación de presiones elevada',
      message: `Pd/Ps = ${result.compressor.targetPressureRatio.toFixed(2)}. La extrapolación de ηv pierde precisión y el aceite puede requerir atención.`,
    })
  }

  if (ratioJump > 0.75) {
    warnings.push({
      code: 'far-extrapolation',
      severity: 'info',
      title: 'Extrapolación lejos de la placa',
      message:
        'La condición de diseño está lejos del punto declarado. La barra de precisión ya incorpora esta penalización.',
    })
  }

  if (
    result.capillary.lengthM < 0.35 ||
    result.capillary.lengthM > 4.5
  ) {
    warnings.push({
      code: 'extreme-capillary',
      severity: 'warning',
      title: 'Capilar fuera de la ventana habitual',
      message: `La combinación recomendada mide ${result.capillary.lengthM.toFixed(2)} m. Revisa el diámetro interior disponible o divide el circuito.`,
    })
  }

  if (result.refrigerant.glideK >= 0.25) {
    warnings.push({
      code: 'blend-glide',
      severity: 'info',
      title: 'Refrigerante zeotrópico',
      message: `Glide aproximada ${result.refrigerant.glideK.toFixed(2)} K. El modelo promedia la curva de saturación; en campo verifica la temperatura de burbuja y rocío.`,
    })
  }

  if (result.targetSaturation.temperatureC < -40 || result.targetSaturation.temperatureC > 15) {
    warnings.push({
      code: 'range',
      severity: 'info',
      title: 'Punto de evaporación poco común',
      message:
        'El resultado sigue siendo válido dentro del modelo, pero conviene contrastarlo con un ensayo de banco.',
    })
  }

  if (
    result.capillary.installedPrediction &&
    Math.abs(result.capillary.installedPrediction.deviationPct) > 30
  ) {
    warnings.push({
      code: 'installed-deviation',
      severity: 'info',
      title: 'El capilar instalado se separa del modelo',
      message: `Diferencia de ${result.capillary.installedPrediction.deviationPct.toFixed(0)} %. Al guardar el caso, esta evidencia ajustará futuras recomendaciones.`,
    })
  }

  return warnings
}

export const calculate = (
  input: CalculationInput,
  options: CalculateOptions = {},
): CalculationResult => {
  const refrigerant = refrigerantById(input.refrigerantId)
  const standard = standardById(input.standardId)
  const referenceSaturation = saturationAtTemperature(
    input.refrigerantId,
    input.refEvapC,
  )
  const targetSaturation = saturationAtTemperature(
    input.refrigerantId,
    input.targetEvapC,
  )
  const referenceCondSaturation = saturationAtTemperature(
    input.refrigerantId,
    input.refCondC,
  )
  const targetCondSaturation = saturationAtTemperature(
    input.refrigerantId,
    input.targetCondC,
  )

  if (input.targetCondC <= input.targetEvapC + 8) {
    throw new Error('La condensación debe superar la evaporación al menos 8 K')
  }

  const referenceSuction = superheatedVaporState(
    input.refrigerantId,
    referenceSaturation.pressureKPa,
    input.refEvapC + input.refSuperheatK,
  )
  const targetSuction = superheatedVaporState(
    input.refrigerantId,
    targetSaturation.pressureKPa,
    input.targetEvapC + input.targetSuperheatK,
  )
  const referenceLiquid = subcooledLiquidState(
    input.refrigerantId,
    referenceCondSaturation.pressureKPa,
    input.refCondC - input.refSubcoolK,
  )
  const targetLiquid = subcooledLiquidState(
    input.refrigerantId,
    targetCondSaturation.pressureKPa,
    input.targetCondC - input.targetSubcoolK,
  )

  const referenceEnthalpyDifference =
    referenceSuction.enthalpyKJkg - referenceLiquid.enthalpyKJkg
  const targetEnthalpyDifference =
    targetSuction.enthalpyKJkg - targetLiquid.enthalpyKJkg

  if (referenceEnthalpyDifference <= 0 || targetEnthalpyDifference <= 0) {
    throw new Error('El salto entálpico calculado no es válido')
  }

  const rpm = rpmFromFrequency(input.frequencyHz)
  const sweptVolumeM3s =
    (input.displacementCm3Rev * 1e-6 * rpm) / 60
  if (sweptVolumeM3s <= 0) {
    throw new Error('El desplazamiento y la frecuencia deben ser positivos')
  }

  const referencePressureRatio = pressureRatio(
    referenceCondSaturation.pressureKPa,
    referenceSaturation.pressureKPa,
  )
  const targetPressureRatio = pressureRatio(
    targetCondSaturation.pressureKPa,
    targetSaturation.pressureKPa,
  )

  const rawEtaVolumetricRef =
    input.ratedCapacityW /
    (sweptVolumeM3s *
      referenceSuction.densityKgM3 *
      referenceEnthalpyDifference *
      1000)

  const efficiency = anchorVolumetricEfficiency({
    measuredEtaRef: rawEtaVolumetricRef,
    referencePressureRatio,
    targetPressureRatio,
  })

  const massFlow = sweptVolumeM3s * targetSuction.densityKgM3 * efficiency.etaTarget
  const capacityW = massFlow * targetEnthalpyDifference * 1000

  const calibration =
    options.calibration && options.calibration.adjusted
      ? options.calibration
      : null
  const capillary = computeCapillary(
    input,
    massFlow,
    targetCondSaturation.pressureKPa,
    targetSaturation.pressureKPa,
    calibration?.factor ?? 1,
  )
  const uncertainty = estimateUncertainty({
    lengthM: capillary.lengthM,
    diameterMm: capillary.diameterMm,
    referencePressureRatio,
    targetPressureRatio,
    calibrationSamples: calibration?.samples ?? 0,
    capacityAnchored: efficiency.anchored,
  })

  const base: Omit<CalculationResult, 'warnings'> = {
    version: appMeta.modelVersion,
    calculatedAt: (options.now ?? new Date()).toISOString(),
    fingerprint: fingerprintOf(input),
    input,
    refrigerant,
    standard,
    referenceSaturation: asSaturationPoint(referenceSaturation),
    targetSaturation: asSaturationPoint(targetSaturation),
    compressor: {
      sweptVolumeM3s,
      massFlowKgS: massFlow,
      capacityW,
      etaVolumetricRef: efficiency.etaRef,
      etaVolumetricTarget: efficiency.etaTarget,
      clearanceRatio: efficiency.clearanceRatio,
      referencePressureRatio,
      targetPressureRatio,
      suctionDensity: targetSuction.densityKgM3,
      suctionEnthalpy: targetSuction.enthalpyKJkg,
      liquidEnthalpy: targetLiquid.enthalpyKJkg,
      enthalpyDifference: targetEnthalpyDifference,
      anchored: efficiency.anchored,
      rawEtaVolumetricRef,
    },
    capillary,
    uncertainty,
    references: {
      model: `${appMeta.modelVersion} · anclaje ηv + capilar 1D`,
      properties: appMeta.propertySource,
      standards: standard.reference,
    },
  }

  return { ...base, warnings: warningsFor(input, base) }
}

export const saturationPreview = (fluid: CalculationInput['refrigerantId'], tempC: number) =>
  asSaturationPoint(saturationAtTemperature(fluid, tempC))

export const saturationAtPressurePreview = (
  fluid: CalculationInput['refrigerantId'],
  pressureKPa: number,
) => asSaturationPoint(saturationAtPressure(fluid, pressureKPa))
