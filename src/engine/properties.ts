import tablesJson from '../data/refrigerantTables.json'
import { refrigerantById } from '../data/catalog'
import type { RefrigerantId, SaturationPoint, ThermoState } from '../types'

type FluidRow = [
  T_C: number,
  pBubble_kPa: number,
  pDew_kPa: number,
  rhoL_kgm3: number,
  rhoV_kgm3: number,
  hL_Jkg: number,
  hV_Jkg: number,
  cpL_JkgK: number,
  cpV_JkgK: number,
  muL_Pas: number,
  muV_Pas: number,
  kL_WmK: number | null,
  kV_WmK: number | null,
  sigma_Nm: number | null,
]

export type SaturationPhase = 'bubble' | 'dew' | 'mean'

interface FluidTable {
  minC: number
  maxC: number
  criticalC: number
  molarMass: number
  tripleC: number | null
  rows: FluidRow[]
}

interface DetailedSaturation extends SaturationPoint {
  cpL: number
  cpV: number
  muL: number
  muV: number
  kL: number | null
  kV: number | null
  sigma: number | null
  molarMass: number
}

const tables = tablesJson.fluids as unknown as Record<string, FluidTable>
const R_UNIVERSAL = 8314.462618

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const fluidTable = (fluid: RefrigerantId): FluidTable => {
  const table = tables[fluid]
  if (!table) {
    throw new Error(`No hay tabla termofísica para ${fluid}`)
  }
  return table
}

const findBracket = (values: number[], target: number): [number, number, number] => {
  const first = values[0]
  const last = values[values.length - 1]
  if (target <= first) return [0, 0, 0]
  if (target >= last) return [values.length - 1, values.length - 1, 0]

  let low = 0
  let high = values.length - 1
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2)
    if (values[mid] <= target) low = mid
    else high = mid
  }
  const span = values[high] - values[low]
  return [low, high, span === 0 ? 0 : (target - values[low]) / span]
}

const rowToSaturation = (row: FluidRow, molarMass: number): DetailedSaturation => {
  const bubblePressureKPa = row[1]
  const dewPressureKPa = row[2]
  return {
    temperatureC: row[0],
    pressureKPa: (bubblePressureKPa + dewPressureKPa) / 2,
    bubblePressureKPa,
    dewPressureKPa,
    liquidDensity: row[3],
    vaporDensity: row[4],
    liquidEnthalpyKJkg: row[5] / 1000,
    vaporEnthalpyKJkg: row[6] / 1000,
    latentHeatKJkg: (row[6] - row[5]) / 1000,
    glideK: 0,
    cpL: row[7] / 1000,
    cpV: row[8] / 1000,
    muL: row[9],
    muV: row[10],
    kL: row[11],
    kV: row[12],
    sigma: row[13],
    molarMass,
  }
}

const blendRows = (
  a: DetailedSaturation,
  b: DetailedSaturation,
  t: number,
  options?: { pressureOverrideKPa?: number; temperatureOverrideC?: number },
): DetailedSaturation => ({
  temperatureC:
    options?.temperatureOverrideC ?? lerp(a.temperatureC, b.temperatureC, t),
  pressureKPa: options?.pressureOverrideKPa ?? lerp(a.pressureKPa, b.pressureKPa, t),
  bubblePressureKPa: lerp(a.bubblePressureKPa, b.bubblePressureKPa, t),
  dewPressureKPa: lerp(a.dewPressureKPa, b.dewPressureKPa, t),
  liquidDensity: lerp(a.liquidDensity, b.liquidDensity, t),
  vaporDensity: lerp(a.vaporDensity, b.vaporDensity, t),
  liquidEnthalpyKJkg: lerp(a.liquidEnthalpyKJkg, b.liquidEnthalpyKJkg, t),
  vaporEnthalpyKJkg: lerp(a.vaporEnthalpyKJkg, b.vaporEnthalpyKJkg, t),
  latentHeatKJkg: lerp(a.latentHeatKJkg, b.latentHeatKJkg, t),
  glideK: lerp(a.glideK, b.glideK, t),
  cpL: lerp(a.cpL, b.cpL, t),
  cpV: lerp(a.cpV, b.cpV, t),
  muL: lerp(a.muL, b.muL, t),
  muV: lerp(a.muV, b.muV, t),
  kL:
    a.kL === null || b.kL === null ? null : lerp(a.kL, b.kL, t),
  kV:
    a.kV === null || b.kV === null ? null : lerp(a.kV, b.kV, t),
  sigma:
    a.sigma === null || b.sigma === null
      ? null
      : lerp(a.sigma, b.sigma, t),
  molarMass: lerp(a.molarMass, b.molarMass, t),
})

export const saturationAtTemperature = (
  fluid: RefrigerantId,
  temperatureC: number,
  phase: SaturationPhase = 'mean',
): DetailedSaturation => {
  const table = fluidTable(fluid)
  if (temperatureC < table.minC || temperatureC > table.maxC) {
    throw new Error(
      `${fluid}: ${temperatureC.toFixed(1)} °C está fuera del rango de la tabla (${table.minC}…${table.maxC} °C)`,
    )
  }

  const temps = table.rows.map((row) => row[0])
  const [low, high, t] = findBracket(temps, temperatureC)
  const a = rowToSaturation(table.rows[low], table.molarMass)
  const b = rowToSaturation(table.rows[high], table.molarMass)
  const saturation = t === 0 ? a : blendRows(a, b, t, { temperatureOverrideC: temperatureC })
  saturation.pressureKPa =
    phase === 'bubble'
      ? saturation.bubblePressureKPa
      : phase === 'dew'
        ? saturation.dewPressureKPa
        : (saturation.bubblePressureKPa + saturation.dewPressureKPa) / 2
  saturation.glideK = refrigerantById(fluid).glideK
  return saturation
}

export const saturationAtPressure = (
  fluid: RefrigerantId,
  pressureKPa: number,
  phase: SaturationPhase = 'mean',
): DetailedSaturation => {
  const table = fluidTable(fluid)
  if (!Number.isFinite(pressureKPa) || pressureKPa <= 0) {
    throw new Error('La presión de saturación debe ser positiva')
  }

  const bubblePressures = table.rows.map((row) => row[1])
  const dewPressures = table.rows.map((row) => row[2])
  const blend = refrigerantById(fluid).glideK >= 0.25

  if (phase === 'mean' && blend) {
    const temperatureAtPressure = (pressures: number[]) => {
      if (pressureKPa < pressures[0] || pressureKPa > pressures.at(-1)!) {
        throw new Error(
          `${fluid}: ${pressureKPa.toFixed(0)} kPa está fuera del rango de saturación disponible`,
        )
      }
      const [low, high, t] = findBracket(pressures, pressureKPa)
      return lerp(table.rows[low][0], table.rows[high][0], t)
    }
    const bubbleTemperature = temperatureAtPressure(bubblePressures)
    const dewTemperature = temperatureAtPressure(dewPressures)
    const bubble = saturationAtTemperature(fluid, bubbleTemperature, 'bubble')
    const dew = saturationAtTemperature(fluid, dewTemperature, 'dew')
    return {
      ...bubble,
      temperatureC: (bubbleTemperature + dewTemperature) / 2,
      pressureKPa,
      bubblePressureKPa: pressureKPa,
      dewPressureKPa: pressureKPa,
      liquidDensity: bubble.liquidDensity,
      vaporDensity: dew.vaporDensity,
      liquidEnthalpyKJkg: bubble.liquidEnthalpyKJkg,
      vaporEnthalpyKJkg: dew.vaporEnthalpyKJkg,
      latentHeatKJkg:
        dew.vaporEnthalpyKJkg - bubble.liquidEnthalpyKJkg,
      cpL: bubble.cpL,
      cpV: dew.cpV,
      muL: bubble.muL,
      muV: dew.muV,
      kL: bubble.kL,
      kV: dew.kV,
    }
  }

  const pressureValues = table.rows.map((row) =>
    phase === 'bubble'
      ? row[1]
      : phase === 'dew'
        ? row[2]
        : (row[1] + row[2]) / 2,
  )
  if (pressureKPa < pressureValues[0] || pressureKPa > pressureValues.at(-1)!) {
    throw new Error(
      `${fluid}: ${pressureKPa.toFixed(0)} kPa está fuera del rango de saturación disponible`,
    )
  }

  const [low, high, t] = findBracket(pressureValues, pressureKPa)
  const temperature = lerp(table.rows[low][0], table.rows[high][0], t)
  const base = saturationAtTemperature(fluid, temperature, phase)
  return {
    ...base,
    pressureKPa,
    bubblePressureKPa: base.bubblePressureKPa,
    dewPressureKPa: base.dewPressureKPa,
  }
}

const compressibilityAtSaturation = (saturation: DetailedSaturation) => {
  const specificGasConstant = R_UNIVERSAL / saturation.molarMass
  return (
    saturation.pressureKPa *
      1000 /
      (saturation.vaporDensity *
        specificGasConstant *
        (saturation.temperatureC + 273.15))
  )
}

export const superheatedVaporState = (
  fluid: RefrigerantId,
  pressureKPa: number,
  temperatureC: number,
): ThermoState => {
  const saturation = saturationAtPressure(fluid, pressureKPa, 'dew')
  const superheat = temperatureC - saturation.temperatureC
  if (superheat < -0.25) {
    throw new Error(
      `La temperatura de aspiración (${temperatureC.toFixed(1)} °C) es inferior a la de saturación (${saturation.temperatureC.toFixed(1)} °C)`,
    )
  }
  const z = clamp(compressibilityAtSaturation(saturation), 0.55, 1.15)
  const specificGasConstant = R_UNIVERSAL / saturation.molarMass
  const density =
    (pressureKPa * 1000) / (z * specificGasConstant * (temperatureC + 273.15))
  const cpAverage = (saturation.cpV + 1.75) / 2

  return {
    pressureKPa,
    temperatureC,
    densityKgM3: density,
    enthalpyKJkg:
      saturation.vaporEnthalpyKJkg + cpAverage * Math.max(0, superheat),
    entropyKJKgK: 0,
  }
}

export const subcooledLiquidState = (
  fluid: RefrigerantId,
  pressureKPa: number,
  temperatureC: number,
): ThermoState => {
  const saturation = saturationAtPressure(fluid, pressureKPa, 'bubble')
  const subcooling = saturation.temperatureC - temperatureC
  if (subcooling < -0.25) {
    throw new Error(
      `El líquido (${temperatureC.toFixed(1)} °C) está por encima de la saturación (${saturation.temperatureC.toFixed(1)} °C)`,
    )
  }
  const expansion = clamp(1 + 0.0016 * subcooling, 0.94, 1.08)
  return {
    pressureKPa,
    temperatureC,
    densityKgM3: saturation.liquidDensity * expansion,
    enthalpyKJkg:
      saturation.liquidEnthalpyKJkg - saturation.cpL * Math.max(0, subcooling),
    entropyKJKgK: 0,
  }
}

export interface CapillarySaturation {
  pressureKPa: number
  temperatureC: number
  vL: number
  vV: number
  hL: number
  hV: number
  muL: number
  muV: number
}

export const capillarySaturationAtPressure = (
  fluid: RefrigerantId,
  pressureKPa: number,
): CapillarySaturation => {
  const saturation = saturationAtPressure(fluid, pressureKPa)
  return {
    pressureKPa,
    temperatureC: saturation.temperatureC,
    vL: 1 / saturation.liquidDensity,
    vV: 1 / saturation.vaporDensity,
    hL: saturation.liquidEnthalpyKJkg * 1000,
    hV: saturation.vaporEnthalpyKJkg * 1000,
    muL: saturation.muL,
    muV: saturation.muV,
  }
}

export const fluidLimits = (fluid: RefrigerantId) => {
  const table = fluidTable(fluid)
  const minimumSaturationPressure = Math.max(
    table.rows[0][1],
    table.rows[0][2],
  )
  const maximumSaturationPressure = Math.min(
    table.rows.at(-1)![1],
    table.rows.at(-1)![2],
  )
  const minDesignEvapC =
    table.rows.find((row) => row[2] >= minimumSaturationPressure)?.[0] ??
    table.minC
  const maxDesignCondC =
    [...table.rows]
      .reverse()
      .find((row) => row[1] <= maximumSaturationPressure)?.[0] ??
    table.maxC
  return {
    minC: table.minC,
    maxC: table.maxC,
    minDesignEvapC,
    maxDesignCondC,
    criticalC: table.criticalC,
    tripleC: table.tripleC,
    molarMass: table.molarMass,
  }
}

export const propertyTableMeta = {
  source: tablesJson.source,
  generatedAt: tablesJson.generatedAt,
  stepK: tablesJson.stepK,
}

export type { DetailedSaturation }
