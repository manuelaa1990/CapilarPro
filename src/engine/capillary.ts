import { correlations, solutions } from '../data/catalog'
import type { CalculationInput, CapillaryCandidate, CapillaryResult, RefrigerantId } from '../types'
import { rankCandidates } from './grid'
import {
  saturationAtPressure,
  saturationSpecificVolumeDerivativesAtPressure,
} from './properties'

export interface OperatingPoint {
  fluid: RefrigerantId
  pressureInKPa: number
  pressureOutKPa: number
  subcoolK: number
  massFlowKgS: number
  inletSubcoolK?: number
  inletEnthalpyKJkg?: number
}

export interface InletConditionOverrides {
  subcoolK: number
  enthalpyKJkg: number
}

export interface Simulation {
  diameterMm: number
  lengthM: number
  massFluxKgM2s: number
  inletVelocityMs: number
  outletQuality: number
  outletPressureKPa: number
  choked: boolean
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

/**
 * Resuelve la calidad termodinámica local a partir del balance de energía
 * de estancamiento:
 *
 *   h0 = hf + x·hfg + G²·[vf + x·vfg]² / 2
 *
 * La raíz físicamente estable es la menor solución positiva.
 */
const qualityFromEnergy = (
  hL: number,
  hV: number,
  vL: number,
  vV: number,
  massFluxSquared: number,
  stagnationEnthalpy: number,
): number => {
  const latentHeat = hV - hL
  const vfg = vV - vL
  const a = 0.5 * massFluxSquared * vfg * vfg
  const b = latentHeat + massFluxSquared * vL * vfg
  const c = hL - stagnationEnthalpy + 0.5 * massFluxSquared * vL * vL

  if (Math.abs(a) < 1e-12) {
    return clamp(-c / Math.max(b, 1e-9), 0, 1)
  }

  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) {
    return clamp((stagnationEnthalpy - hL) / Math.max(latentHeat, 1), 0, 1)
  }

  const rootA = (-b + Math.sqrt(discriminant)) / (2 * a)
  const rootB = (-b - Math.sqrt(discriminant)) / (2 * a)
  const candidates = [rootA, rootB].filter(
    (root) => Number.isFinite(root) && root >= -0.0001 && root <= 1.0001,
  )
  if (candidates.length > 0) {
    return clamp(Math.min(...candidates), 0, 1)
  }
  return clamp(Math.min(rootA, rootB), 0, 1)
}

/**
 * Modelo 1D de capilar adiabático:
 * - calidad local por balance de energía;
 * - viscosidad homogénea másica;
 * - fricción de Darcy con régimen laminar/turbulento;
 * - corrección de deslizamiento bifásico;
 * - integración sobre la curva de saturación.
 *
 * Es un modelo de ingeniería reproducible, no una simulación CFD. La
 * incertidumbre del modelo se propaga y se muestra en la interfaz.
 */
export const simulateCapillaryLength = (
  diameterMm: number,
  operating: OperatingPoint,
): Simulation | null => {
  const config = correlations.capillary
  const diameterM = diameterMm / 1000
  const area = (Math.PI / 4) * diameterM * diameterM
  if (area <= 0 || operating.massFlowKgS <= 0) return null

  const massFlux = operating.massFlowKgS / area
  const inlet = saturationAtPressure(
    operating.fluid,
    operating.pressureInKPa,
    'bubble',
  )
  if (operating.pressureInKPa <= operating.pressureOutKPa) return null

  const inletSubcoolK = operating.inletSubcoolK ?? operating.subcoolK
  const inletEnthalpyKJkg =
    operating.inletEnthalpyKJkg ??
    inlet.liquidEnthalpyKJkg - inlet.cpL * inletSubcoolK
  const inletEnthalpy = inletEnthalpyKJkg * 1000
  const inletDensity =
    inlet.liquidDensity * (1 + 0.0016 * inletSubcoolK)
  const inletSpecificVolume = 1 / inletDensity
  const massFluxSquared = massFlux * massFlux
  const inletLossPa =
    config.inletLossCoefficient * massFluxSquared * inletSpecificVolume / 2
  const integrationInletPressureKPa =
    operating.pressureInKPa - inletLossPa / 1000
  if (integrationInletPressureKPa <= operating.pressureOutKPa) return null
  const stagnationEnthalpy =
    inletEnthalpy + 0.5 * massFluxSquared * inletSpecificVolume ** 2

  const steps = config.pressureSteps
  const pressureStep =
    (integrationInletPressureKPa - operating.pressureOutKPa) / steps
  let length = 0
  let outletQuality = 0
  let lastPressure = integrationInletPressureKPa
  let choked = false

  for (let index = 0; index < steps; index += 1) {
    let p0 = integrationInletPressureKPa - pressureStep * index
    const segmentEndPressure = p0 - pressureStep
    let refinementDepth = 0

    while (p0 > segmentEndPressure) {
      const refinedStep = pressureStep / 2 ** refinementDepth
      const p1 = Math.max(p0 - refinedStep, segmentEndPressure)
      const midpoint = (p0 + p1) / 2

      const state0 = saturationAtPressure(operating.fluid, p0)
      const state1 = saturationAtPressure(operating.fluid, Math.max(p1, 1))
      const middle = saturationAtPressure(operating.fluid, Math.max(midpoint, 1))

      const x0 = qualityFromEnergy(
        state0.liquidEnthalpyKJkg * 1000,
        state0.vaporEnthalpyKJkg * 1000,
        1 / state0.liquidDensity,
        1 / state0.vaporDensity,
        massFluxSquared,
        stagnationEnthalpy,
      )
      const x1 = qualityFromEnergy(
        state1.liquidEnthalpyKJkg * 1000,
        state1.vaporEnthalpyKJkg * 1000,
        1 / state1.liquidDensity,
        1 / state1.vaporDensity,
        massFluxSquared,
        stagnationEnthalpy,
      )
      const volume0 =
        1 / state0.liquidDensity +
        x0 * (1 / state0.vaporDensity - 1 / state0.liquidDensity)
      const volume1 =
        1 / state1.liquidDensity +
        x1 * (1 / state1.vaporDensity - 1 / state1.liquidDensity)
      const averageVolume = (volume0 + volume1) / 2
      const averageQuality = clamp((x0 + x1) / 2, 0, 1)

      if (
        volume1 > volume0 * 1.2 &&
        refinementDepth < 10 &&
        p0 - p1 > pressureStep / 1024
      ) {
        refinementDepth += 1
        continue
      }

      const viscosity =
        1 /
        Math.max(
          averageQuality / middle.muV + (1 - averageQuality) / middle.muL,
          1e-12,
        )
      const reynolds = (massFlux * diameterM) / Math.max(viscosity, 1e-9)
      const friction =
        reynolds > config.criticalReynolds
          ? config.frictionTurbulentCoefficient *
            Math.pow(reynolds, -config.frictionTurbulentExponent)
          : config.frictionLaminarCoefficient / Math.max(reynolds, 1)

      const slipMultiplier =
        1 +
        config.twoPhaseMultiplierCoefficient *
          averageQuality *
          Math.sqrt(Math.max(1, volume1 / Math.max(volume0, 1e-12)))

      const frictionPressureGradient =
        (slipMultiplier * friction * massFluxSquared * averageVolume) /
        (2 * diameterM)

      if (
        !Number.isFinite(frictionPressureGradient) ||
        frictionPressureGradient <= 0
      ) {
        return null
      }

      const deltaPressurePa = (p0 - p1) * 1000
      const saturationDerivatives =
        saturationSpecificVolumeDerivativesAtPressure(
          operating.fluid,
          midpoint,
        )
      const analyticVolumeGradient = saturationDerivatives
        ? (1 - averageQuality) * saturationDerivatives.liquidM3KgPerPa +
          averageQuality * saturationDerivatives.vaporM3KgPerPa
        : null
      const specificVolumeGradient =
        analyticVolumeGradient ??
        (volume1 - volume0) / -deltaPressurePa
      // c² = -v²/(dv/dP); unlike v/(dv/dP), this has velocity-squared units.
      const soundSpeedSquared =
        specificVolumeGradient < 0
          ? -(averageVolume * averageVolume) / specificVolumeGradient
          : Number.NaN
      const fluidVelocity = massFlux * averageVolume
      const isSonic =
        Number.isFinite(soundSpeedSquared) &&
        soundSpeedSquared > 0 &&
        fluidVelocity > Math.sqrt(soundSpeedSquared)
      const momentumFactor = 1 + massFluxSquared * specificVolumeGradient

      if (!Number.isFinite(momentumFactor)) return null
      if (isSonic) {
        choked = true
        lastPressure = p0
        outletQuality = x0
        break
      }

      if (momentumFactor <= 0) return null
      const pressureGradient = frictionPressureGradient / momentumFactor
      length += deltaPressurePa / pressureGradient
      // La salida del tubo es el estado a P_out, es decir x1 (no x0, que es
      // el extremo de entrada del último tramo).
      outletQuality = x1
      lastPressure = p1
      p0 = p1
    }

    if (choked) break
  }

  if (!Number.isFinite(length) || length <= 0) return null

  const inletVelocity = massFlux / inletDensity

  return {
    diameterMm,
    lengthM: length,
    massFluxKgM2s: massFlux,
    inletVelocityMs: inletVelocity,
    outletQuality,
    outletPressureKPa: lastPressure,
    choked,
  }
}

export const asCandidate = (
  simulation: Simulation,
): CapillaryCandidate => {
  return {
    diameterMm: simulation.diameterMm,
    lengthM: simulation.lengthM,
    rawLengthM: simulation.lengthM,
    massFluxKgM2s: simulation.massFluxKgM2s,
    inletVelocityMs: simulation.inletVelocityMs,
    outletQuality: simulation.outletQuality,
    outletPressureKPa: simulation.outletPressureKPa,
    choked: simulation.choked,
    status: 'alternative',
    note: '',
  }
}

interface AssemblyContext {
  pressureInKPa: number
  pressureOutKPa: number
}

/**
 * Construye el resultado final a partir de candidatos ya evaluados en su
 * punto de operación. Con SLHX cada diámetro se resuelve por separado, de modo
 * que la lista puede contener estados con caudales ligeramente distintos.
 */
export const assembleCapillaryResult = (
  ranked: CapillaryCandidate[],
  { pressureInKPa, pressureOutKPa }: AssemblyContext,
): CapillaryResult => {
  if (ranked.length === 0) {
    throw new Error(
      'No se pudo resolver el capilar con las condiciones introducidas. Revisa presiones, subenfriamiento y caudal másico.',
    )
  }
  const selected = ranked[0]

  return {
    diameterMm: selected.diameterMm,
    lengthM: selected.lengthM,
    innerDiameterMm: selected.diameterMm,
    massFluxKgM2s: selected.massFluxKgM2s,
    inletVelocityMs: selected.inletVelocityMs,
    outletQuality: selected.outletQuality,
    outletPressureKPa: selected.outletPressureKPa,
    pressureDropKPa: pressureInKPa - pressureOutKPa,
    choked: selected.choked,
    status: selected.status,
    note: selected.note,
    alternatives: ranked.slice(1, 6),
  }
}

export const computeCapillary = (
  input: CalculationInput,
  massFlowKgS: number,
  pressureInKPa: number,
  pressureOutKPa: number,
  inletOverrides?: InletConditionOverrides,
): CapillaryResult => {
  const config = correlations.capillary
  const operating: OperatingPoint = {
    fluid: input.refrigerantId,
    pressureInKPa,
    pressureOutKPa,
    subcoolK: input.targetSubcoolK,
    massFlowKgS,
    inletSubcoolK: inletOverrides?.subcoolK,
    inletEnthalpyKJkg: inletOverrides?.enthalpyKJkg,
  }
  const candidates = solutions.capillaryIdsMm
    .map((diameter) => simulateCapillaryLength(diameter, operating))
    .filter((simulation): simulation is Simulation => simulation !== null)
    .map((simulation) => asCandidate(simulation))
    .filter((candidate) => candidate.lengthM <= config.maxLengthM * 2.2)

  const ranked = rankCandidates(candidates, {
    designLengthM: config.designLengthM,
    minViableLengthM: config.lengthRangeM[0],
    maxViableLengthM: config.lengthRangeM[1],
  })

  return assembleCapillaryResult(ranked, {
    pressureInKPa,
    pressureOutKPa,
  })
}

export const predictLengthForDiameter = (
  input: CalculationInput,
  massFlowKgS: number,
  pressureInKPa: number,
  pressureOutKPa: number,
  diameterMm: number,
): number | null => {
  const simulation = simulateCapillaryLength(diameterMm, {
    fluid: input.refrigerantId,
    pressureInKPa,
    pressureOutKPa,
    subcoolK: input.targetSubcoolK,
    massFlowKgS,
  })
  return simulation?.lengthM ?? null
}
