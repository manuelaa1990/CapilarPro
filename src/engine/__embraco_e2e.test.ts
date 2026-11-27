import { describe, it } from 'vitest'
import type { CalculationInput, CompressorApplication, RefrigerantId } from '../types'
import { calculate } from './calculate'
import { simulateCapillaryLength } from './capillary'
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

/**
 * Dimensiona el desplazamiento para que la Î·v del ancla quede en un valor
 * fÃ­sico (~0.7). AsÃ­ el caudal mÃ¡sico corresponde a la capacidad de tabla y
 * la comparaciÃ³n no queda contaminada por el recorte de Î·v a 0.95.
 */
const displacementForEta = (
  row: Row,
  condC: number,
  subcoolK: number,
  returnGasC: number,
  etaTarget = 0.7,
): number => {
  const evap = saturationAtTemperature(row.fluid, row.evapC, 'dew')
  const cond = saturationAtTemperature(row.fluid, condC, 'bubble')
  const suction = superheatedVaporState(row.fluid, evap.pressureKPa, returnGasC)
  const liquid = subcooledLiquidState(
    row.fluid,
    cond.pressureKPa,
    condC - subcoolK,
  )
  const dh = suction.enthalpyKJkg - liquid.enthalpyKJkg
  const sweptVolume = row.capacityW / (etaTarget * suction.densityKgM3 * dh * 1000)
  return (sweptVolume * 60 * 1e6) / RPM
}

const inputFor = (
  row: Row,
  opts: { condC: number; subcoolK: number; slhx: boolean; returnGasC: number },
): CalculationInput => ({
  refrigerantId: row.fluid,
  compressorId: 'custom',
  compressorLabel: '',
  standardId: 'custom',
  application: row.application,
  declaredApplication: row.application,
  ratedCapacity: row.capacityW,
  capacityUnit: 'W',
  displacement: displacementForEta(
    row,
    opts.condC,
    opts.subcoolK,
    opts.returnGasC,
  ),
  displacementUnit: 'cmÂ³/rev',
  frequencyHz: 50,
  refEvapC: row.evapC,
  refCondC: opts.condC,
  ambientTempC: 32.2,
  returnGasTempC: opts.returnGasC,
  refSuperheatK: opts.returnGasC - row.evapC,
  refSubcoolK: opts.subcoolK,
  targetEvapC: row.evapC,
  targetCondC: opts.condC,
  targetReturnGasTempC: opts.returnGasC,
  targetAmbientTempC: 32.2,
  targetSuperheatK: opts.returnGasC - row.evapC,
  targetSubcoolK: opts.subcoolK,
  slhxActivo: opts.slhx,
  slhxPorcentaje: 50,
  slhxDiametroSuccion: '5/16',
})

const pct = (value: number, reference: number) =>
  `${(((value - reference) / reference) * 100).toFixed(0)}%`

describe('embraco end-to-end probe', () => {
  it('logs calculate() against table rows', () => {
    const variants = [
      { label: 'SC0 no SLHX', condC: 54.4, subcoolK: 0, slhx: false, returnGasC: 32.2 },
      { label: 'SC5 no SLHX', condC: 54.4, subcoolK: 5, slhx: false, returnGasC: 32.2 },
      { label: 'SC0 SLHX', condC: 54.4, subcoolK: 0, slhx: true, returnGasC: 32.2 },
      { label: 'SC0 45C', condC: 45, subcoolK: 0, slhx: false, returnGasC: 32.2 },
      { label: 'SC0 SH5', condC: 54.4, subcoolK: 0, slhx: false, returnGasC: -5 },
    ]
    const out: Record<string, unknown>[] = []
    for (const row of rows) {
      for (const variant of variants) {
        const input = inputFor(row, variant)
        let line: Record<string, unknown>
        try {
          const result = calculate(input)
          const cap = result.capillary
          const condPressure = saturationAtTemperature(
            row.fluid,
            variant.condC,
            'bubble',
          ).pressureKPa
          const refDLength = simulateCapillaryLength(row.refD, {
            fluid: row.fluid,
            pressureInKPa: condPressure,
            pressureOutKPa: result.targetSaturation.pressureKPa,
            subcoolK: input.targetSubcoolK,
            inletEnthalpyKJkg: result.compressor.liquidEnthalpy,
            massFlowKgS: result.compressor.massFlowKgS,
          })
          line = {
            case: row.name,
            variant: variant.label,
            ref: `${row.refD}x${row.refL}`,
            sel: `${cap.diameterMm.toFixed(3)}x${cap.lengthM.toFixed(2)}`,
            selDpct: pct(cap.diameterMm, row.refD),
            selLpct: pct(cap.lengthM, row.refL),
            lenAtRefD: refDLength ? refDLength.lengthM.toFixed(2) : null,
            lenAtRefDpct: refDLength ? pct(refDLength.lengthM, row.refL) : null,
            chokedAtRefD: refDLength?.choked ?? null,
            mflowGps: (result.compressor.massFlowKgS * 1000).toFixed(2),
            etaV: (result.compressor.etaVolumetricTarget * 100).toFixed(0) + '%',
            qW: result.compressor.capacityW.toFixed(0),
            status: cap.status,
          }
        } catch (error) {
          line = { case: row.name, variant: variant.label, error: String(error).slice(0, 80) }
        }
        out.push(line)
      }
    }
     
    console.table(out)
     
    console.log(JSON.stringify(out))
  })
})
