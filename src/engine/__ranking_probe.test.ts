import { describe, it } from 'vitest'
import { correlations, solutions } from '../data/catalog'
import { defaultInput } from '../store/schemas'
import type { CalculationInput, CompressorApplication, RefrigerantId } from '../types'
import { calculate } from './calculate'
import { asCandidate, simulateCapillaryLength } from './capillary'
import { rankCandidates } from './grid'
import {
  saturationAtTemperature,
  subcooledLiquidState,
  superheatedVaporState,
} from './properties'

interface Row {
  name: string
  fluid: RefrigerantId
  application: CompressorApplication
  evapC: number
  capacityW: number
  refD: number
  refL: number
}

const rows: Row[] = [
  { name: 'R600a LBP 60-80', fluid: 'R600a', application: 'LBP', evapC: -25, capacityW: 70, refD: 0.66, refL: 4.0 },
  { name: 'R600a LBP 105-140', fluid: 'R600a', application: 'LBP', evapC: -25, capacityW: 122.5, refD: 0.787, refL: 3.2 },
  { name: 'R600a HBP 275-350', fluid: 'R600a', application: 'HBP', evapC: -10, capacityW: 312.5, refD: 0.787, refL: 2.5 },
  { name: 'R134a LBP 300-400', fluid: 'R134a', application: 'LBP', evapC: -27.5, capacityW: 350, refD: 0.914, refL: 2.9 },
  { name: 'R134a LBP 500-680', fluid: 'R134a', application: 'LBP', evapC: -27.5, capacityW: 590, refD: 1.067, refL: 3.0 },
  { name: 'R134a HBP 275-350', fluid: 'R134a', application: 'HBP', evapC: -10, capacityW: 312.5, refD: 0.787, refL: 2.5 },
  { name: 'R134a HBP 570-750', fluid: 'R134a', application: 'HBP', evapC: -10, capacityW: 660, refD: 0.914, refL: 2.9 },
  { name: 'R290 M/HBP 350-400', fluid: 'R290', application: 'MBP', evapC: -12.5, capacityW: 375, refD: 1.067, refL: 3.3 },
  { name: 'R290 M/HBP 850-1050', fluid: 'R290', application: 'MBP', evapC: -12.5, capacityW: 950, refD: 1.27, refL: 2.55 },
  { name: 'R404A LBP 500-650', fluid: 'R404A', application: 'LBP', evapC: -30, capacityW: 575, refD: 0.914, refL: 2.7 },
  { name: 'R404A LBP 1050-1400', fluid: 'R404A', application: 'LBP', evapC: -30, capacityW: 1225, refD: 1.4, refL: 3.5 },
]

const RPM = 3000

const displacementForEta = (row: Row, etaTarget = 0.7): number => {
  const evap = saturationAtTemperature(row.fluid, row.evapC, 'dew')
  const cond = saturationAtTemperature(row.fluid, 54.4, 'bubble')
  const suction = superheatedVaporState(row.fluid, evap.pressureKPa, 32.2)
  const liquid = subcooledLiquidState(row.fluid, cond.pressureKPa, 54.4)
  const dh = suction.enthalpyKJkg - liquid.enthalpyKJkg
  const sweptVolume = row.capacityW / (etaTarget * suction.densityKgM3 * dh * 1000)
  return (sweptVolume * 60 * 1e6) / RPM
}

const inputFor = (row: Row): CalculationInput => ({
  refrigerantId: row.fluid,
  compressorId: 'custom',
  compressorLabel: '',
  standardId: 'custom',
  application: row.application,
  declaredApplication: row.application,
  ratedCapacity: row.capacityW,
  capacityUnit: 'W',
  displacement: displacementForEta(row),
  displacementUnit: 'cm³/rev',
  frequencyHz: 50,
  refEvapC: row.evapC,
  refCondC: 54.4,
  ambientTempC: 32.2,
  returnGasTempC: 32.2,
  refSuperheatK: 32.2 - row.evapC,
  refSubcoolK: 0,
  targetEvapC: row.evapC,
  targetCondC: 54.4,
  targetReturnGasTempC: 32.2,
  targetAmbientTempC: 32.2,
  targetSuperheatK: 32.2 - row.evapC,
  targetSubcoolK: 0,
  slhxActivo: false,
  slhxPorcentaje: 50,
  slhxDiametroSuccion: '5/16',
})

const pct = (value: number, reference: number) =>
  `${(((value - reference) / reference) * 100).toFixed(0)}%`

describe('ranking target probe', () => {
  it('shows the effect of the design length target', () => {
    const out: Record<string, unknown>[] = []
    for (const row of rows) {
      const result = calculate(inputFor(row))
      const condP = saturationAtTemperature(row.fluid, 54.4, 'bubble').pressureKPa
      const operating = {
        fluid: row.fluid,
        pressureInKPa: condP,
        pressureOutKPa: result.targetSaturation.pressureKPa,
        subcoolK: 0,
        inletEnthalpyKJkg: result.compressor.liquidEnthalpy,
        massFlowKgS: result.compressor.massFlowKgS,
      }
      const candidates = solutions.capillaryIdsMm
        .map((d) => simulateCapillaryLength(d, operating))
        .filter((s) => s !== null)
        .map((s) => asCandidate(s))
      const at = (designLengthM: number) => {
        const ranked = rankCandidates(candidates, {
          designLengthM,
          minViableLengthM: 0.35,
          maxViableLengthM: 4.5,
        })
        return `${ranked[0].diameterMm.toFixed(3)}x${ranked[0].lengthM.toFixed(2)}`
      }
      out.push({
        case: row.name,
        ref: `${row.refD}x${row.refL}`,
        atRef: (() => {
          const s = simulateCapillaryLength(row.refD, operating)
          return s ? `${s.lengthM.toFixed(2)} (${pct(s.lengthM, row.refL)})` : null
        })(),
        t18: at(1.8),
        t25: at(2.5),
        t30: at(3.0),
      })
    }
     
    console.table(out)
     
    console.log(JSON.stringify(out))
  })

  it('shows the eta-v extrapolation effect on the default case', () => {
    const input = defaultInput()
    const atPlate = calculate(input)
    const anchored = calculate({
      ...input,
      refEvapC: input.targetEvapC,
      refCondC: input.targetCondC,
      refSuperheatK: input.targetSuperheatK,
      refSubcoolK: input.targetSubcoolK,
    })
     
    console.log(
      JSON.stringify(
        {
          plate: {
            etaRef: atPlate.compressor.etaVolumetricRef,
            etaTarget: atPlate.compressor.etaVolumetricTarget,
            massFlow: atPlate.compressor.massFlowKgS,
            capacity: atPlate.compressor.capacityW,
            capillary: `${atPlate.capillary.diameterMm}x${atPlate.capillary.lengthM.toFixed(2)}`,
          },
          anchored: {
            etaRef: anchored.compressor.etaVolumetricRef,
            etaTarget: anchored.compressor.etaVolumetricTarget,
            massFlow: anchored.compressor.massFlowKgS,
            capacity: anchored.compressor.capacityW,
            capillary: `${anchored.capillary.diameterMm}x${anchored.capillary.lengthM.toFixed(2)}`,
          },
          config: correlations.capillary,
        },
        null,
        2,
      ),
    )
  })
})
