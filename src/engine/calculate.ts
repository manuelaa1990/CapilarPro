import {
  appMeta,
  correlations,
  refrigerantById,
  solutions,
  standardById,
} from '../data/catalog'
import type {
  CalculationInput,
  CalculationResult,
  CalculationWarning,
  CapillaryCandidate,
  CapillaryResult,
} from '../types'
import {
  assembleCapillaryResult,
  asCandidate,
  computeCapillary,
  simulateCapillaryLength,
  type OperatingPoint,
  type Simulation,
} from './capillary'
import { fingerprintOf } from './fingerprint'
import { rankCandidates } from './grid'
import { calculateSlhxTransfer } from './slhx'
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
import {
  capacityToWatts,
  displacementToCubicCentimeters,
} from './units'

interface CalculateOptions {
  now?: Date
}

interface SlhxOperatingState {
  massFlowKgS: number
  simulation: Simulation
  suction: ReturnType<typeof superheatedVaporState> & { enthalpyKJkg: number }
  liquidEnthalpyKJkg: number
  slhx: ReturnType<typeof calculateSlhxTransfer>
  operating: OperatingPoint
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
  bubblePressureKPa: saturation.bubblePressureKPa,
  dewPressureKPa: saturation.dewPressureKPa,
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

  const condenserApproachC =
    input.targetCondC - input.targetAmbientTempC
  if (condenserApproachC < 5) {
    warnings.push({
      code: 'low-condenser-approach',
      severity: 'warning',
      title: 'Salto térmico del condensador bajo',
      message: `La condensación supera el ambiente solo ${condenserApproachC.toFixed(1)} K. Verifica el flujo de aire y la temperatura ambiente.`,
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
      message: `Glide aproximada ${result.refrigerant.glideK.toFixed(2)} K. Ps usa el punto de rocío y Pd el de burbuja; verifica ambas temperaturas en campo.`,
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
  if (
    !Number.isFinite(input.slhxPorcentaje) ||
    input.slhxPorcentaje < 30 ||
    input.slhxPorcentaje > 70
  ) {
    throw new Error('El porcentaje de enrollado SLHX debe estar entre 30 y 70')
  }

  const targetSuperheatK =
    input.targetReturnGasTempC - input.targetEvapC
  if (targetSuperheatK < 0) {
    throw new Error(
      'La temperatura de retorno del gas debe ser igual o mayor que la evaporación objetivo',
    )
  }
  const calculationInput = { ...input, targetSuperheatK }
  const refrigerant = refrigerantById(input.refrigerantId)
  const standard = standardById(input.standardId)
  const referenceSaturation = saturationAtTemperature(
    input.refrigerantId,
    input.refEvapC,
    'dew',
  )
  const targetSaturation = saturationAtTemperature(
    input.refrigerantId,
    input.targetEvapC,
    'dew',
  )
  const referenceCondSaturation = saturationAtTemperature(
    input.refrigerantId,
    input.refCondC,
    'bubble',
  )
  const targetCondSaturation = saturationAtTemperature(
    input.refrigerantId,
    input.targetCondC,
    'bubble',
  )

  if (input.targetCondC <= input.targetEvapC + 8) {
    throw new Error('La condensación debe superar la evaporación al menos 8 K')
  }

  const referenceSuction = superheatedVaporState(
    input.refrigerantId,
    referenceSaturation.pressureKPa,
    input.refEvapC + input.refSuperheatK,
  )
  const targetSuctionIn = superheatedVaporState(
    input.refrigerantId,
    targetSaturation.pressureKPa,
    input.targetReturnGasTempC,
  )
  const referenceLiquid = subcooledLiquidState(
    input.refrigerantId,
    referenceCondSaturation.pressureKPa,
    input.refCondC - input.refSubcoolK,
  )
  const targetLiquidIn = subcooledLiquidState(
    input.refrigerantId,
    targetCondSaturation.pressureKPa,
    input.targetCondC - input.targetSubcoolK,
  )

  const referenceEnthalpyDifference =
    referenceSuction.enthalpyKJkg - referenceLiquid.enthalpyKJkg

  if (referenceEnthalpyDifference <= 0) {
    throw new Error('El salto entálpico calculado no es válido')
  }

  const rpm = rpmFromFrequency(input.frequencyHz)
  const sweptVolumeM3s =
    (displacementToCubicCentimeters(
      input.displacement,
      input.displacementUnit,
    ) *
      1e-6 *
      rpm) /
    60
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
    capacityToWatts(input.ratedCapacity, input.capacityUnit) /
    (sweptVolumeM3s *
      referenceSuction.densityKgM3 *
      referenceEnthalpyDifference *
      1000)

  const efficiency = anchorVolumetricEfficiency({
    measuredEtaRef: rawEtaVolumetricRef,
    referencePressureRatio,
    targetPressureRatio,
  })

  // El motor trabaja en J/(kg·K); las tablas guardan kJ/(kg·K).
  const cpLiquid = targetCondSaturation.cpL * 1000
  const cpSuction = targetSaturation.cpV * 1000
  const inletTemperatureDifference = Math.max(
    0,
    targetLiquidIn.temperatureC - input.targetReturnGasTempC,
  )
  if (
    input.slhxActivo &&
    (!Number.isFinite(cpLiquid) ||
      cpLiquid <= 0 ||
      !Number.isFinite(cpSuction) ||
      cpSuction <= 0)
  ) {
    throw new Error('No hay capacidades caloríficas válidas para calcular el SLHX')
  }
  const massFlowGuess =
    sweptVolumeM3s * targetSuctionIn.densityKgM3 * efficiency.etaTarget
  let capillary: CapillaryResult
  let targetSuction = targetSuctionIn
  let targetLiquidEnthalpyKJkg = targetLiquidIn.enthalpyKJkg
  let massFlow = massFlowGuess
  let slhxResult: ReturnType<typeof calculateSlhxTransfer> | null = null

  if (input.slhxActivo) {
    // Cada diámetro comercial se resuelve por separado hasta que caudal,
    // calor transferido y longitud son consistentes. Después se comparan los
    // estados ya convergidos: así el ranking no puede alternar entre dos
    // medidas casi empatadas y realimentar el bucle.
    const config = correlations.capillary
    const baselineCapillary = computeCapillary(
      input,
      massFlowGuess,
      targetCondSaturation.pressureKPa,
      targetSaturation.pressureKPa,
    )
    const converged = new Map<number, SlhxOperatingState>()

    for (const diameterMm of solutions.capillaryIdsMm) {
      const operatingBase = {
        fluid: input.refrigerantId,
        pressureInKPa: targetCondSaturation.pressureKPa,
        pressureOutKPa: targetSaturation.pressureKPa,
        subcoolK: input.targetSubcoolK,
      }
      let currentMassFlow = massFlowGuess
      let currentSimulation = simulateCapillaryLength(diameterMm, {
        ...operatingBase,
        massFlowKgS: currentMassFlow,
      })
      if (
        !currentSimulation ||
        currentSimulation.lengthM > config.maxLengthM * 2.2
      ) {
        continue
      }

      for (let iteration = 0; iteration < 40; iteration += 1) {
        const currentSlhx = calculateSlhxTransfer({
          massFlowKgS: currentMassFlow,
          gasSpecificHeatJKgK: cpSuction,
          inletTemperatureDifferenceK: inletTemperatureDifference,
          totalCapillaryLengthM: currentSimulation.lengthM,
          windingPercentage: input.slhxPorcentaje,
          suctionTubeDiameter: input.slhxDiametroSuccion,
        })
        const heatTransferPerMass = currentSlhx.heatTransferPerMassJKg
        const adjustedSuctionTemperature =
          input.targetReturnGasTempC + heatTransferPerMass / cpSuction
        const suctionForIteration = {
          ...superheatedVaporState(
            input.refrigerantId,
            targetSaturation.pressureKPa,
            adjustedSuctionTemperature,
          ),
          enthalpyKJkg:
            targetSuctionIn.enthalpyKJkg + heatTransferPerMass / 1000,
        }
        const adjustedLiquidEnthalpy =
          targetLiquidIn.enthalpyKJkg - heatTransferPerMass / 1000
        const adjustedSubcooling =
          input.targetSubcoolK + heatTransferPerMass / cpLiquid
        const nextMassFlow =
          sweptVolumeM3s *
          suctionForIteration.densityKgM3 *
          efficiency.etaTarget
        const nextSimulation = simulateCapillaryLength(diameterMm, {
          ...operatingBase,
          massFlowKgS: nextMassFlow,
          inletSubcoolK: adjustedSubcooling,
          inletEnthalpyKJkg: adjustedLiquidEnthalpy,
        })
        if (!nextSimulation) break

        const massFlowConverged =
          Math.abs(nextMassFlow - currentMassFlow) <=
          Math.max(nextMassFlow, 1e-12) * 1e-6
        const lengthConverged =
          Math.abs(nextSimulation.lengthM - currentSimulation.lengthM) <=
          Math.max(nextSimulation.lengthM, 1e-12) * 1e-6

        currentMassFlow = nextMassFlow
        currentSimulation = nextSimulation

        if (massFlowConverged && lengthConverged) {
          converged.set(diameterMm, {
            massFlowKgS: nextMassFlow,
            simulation: nextSimulation,
            suction: suctionForIteration,
            liquidEnthalpyKJkg: adjustedLiquidEnthalpy,
            slhx: currentSlhx,
            operating: {
              ...operatingBase,
              massFlowKgS: nextMassFlow,
              inletSubcoolK: adjustedSubcooling,
              inletEnthalpyKJkg: adjustedLiquidEnthalpy,
            },
          })
          break
        }
      }
    }

    const candidates: CapillaryCandidate[] = []
    for (const state of converged.values()) {
      const candidate = asCandidate(state.simulation)
      if (candidate.lengthM <= config.maxLengthM * 2.2) {
        candidates.push(candidate)
      }
    }
    const ranked = rankCandidates(candidates, {
      designLengthM: config.designLengthM,
      minViableLengthM: config.lengthRangeM[0],
      maxViableLengthM: config.lengthRangeM[1],
      preferredDiameterMm: baselineCapillary.diameterMm,
    })
    const selectedCandidate = ranked[0]
    const selectedState = selectedCandidate
      ? converged.get(selectedCandidate.diameterMm)
      : undefined
    if (!selectedState) {
      throw new Error(
        'El cálculo iterativo del SLHX no convergió en ningún diámetro comercial',
      )
    }

    massFlow = selectedState.massFlowKgS
    targetSuction = selectedState.suction
    targetLiquidEnthalpyKJkg = selectedState.liquidEnthalpyKJkg
    slhxResult = selectedState.slhx
    capillary = assembleCapillaryResult(ranked, {
      input,
      operating: selectedState.operating,
      pressureInKPa: targetCondSaturation.pressureKPa,
      pressureOutKPa: targetSaturation.pressureKPa,
    })
  } else {
    capillary = computeCapillary(
      input,
      massFlowGuess,
      targetCondSaturation.pressureKPa,
      targetSaturation.pressureKPa,
    )
  }

  const targetEnthalpyDifference =
    targetSuction.enthalpyKJkg - targetLiquidEnthalpyKJkg
  if (targetEnthalpyDifference <= 0) {
    throw new Error('El salto entálpico calculado no es válido')
  }

  const capacityW = massFlow * targetEnthalpyDifference * 1000
  const uncertainty = estimateUncertainty({
    lengthM: capillary.lengthM,
    diameterMm: capillary.diameterMm,
    referencePressureRatio,
    targetPressureRatio,
    capacityAnchored: efficiency.anchored,
  })

  const base: Omit<CalculationResult, 'warnings'> = {
    version: appMeta.modelVersion,
    calculatedAt: (options.now ?? new Date()).toISOString(),
    fingerprint: fingerprintOf(calculationInput),
    input: calculationInput,
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
      liquidEnthalpy: targetLiquidEnthalpyKJkg,
      enthalpyDifference: targetEnthalpyDifference,
      anchored: efficiency.anchored,
      rawEtaVolumetricRef,
    },
    capillary,
    slhx: slhxResult
      ? {
          lengthWoundM: slhxResult.lengthWoundM,
          epsilonReal: slhxResult.epsilonReal,
          uWm2K: slhxResult.uWm2K,
          suctionDiameterM: slhxResult.suctionDiameterM,
        }
      : null,
    uncertainty,
    references: {
      model: `${appMeta.modelVersion} · anclaje ηv + capilar 1D`,
      properties: appMeta.propertySource,
      standards: standard.reference,
    },
  }

  return { ...base, warnings: warningsFor(calculationInput, base) }
}

export const saturationPreview = (fluid: CalculationInput['refrigerantId'], tempC: number) =>
  asSaturationPoint(saturationAtTemperature(fluid, tempC))

export const saturationAtPressurePreview = (
  fluid: CalculationInput['refrigerantId'],
  pressureKPa: number,
) => asSaturationPoint(saturationAtPressure(fluid, pressureKPa))
