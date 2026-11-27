import { describe, it } from 'vitest'
import { solutions } from '../data/catalog'
import type { RefrigerantId } from '../types'
import { simulateCapillaryLength } from './capillary'
import {
  saturationAtTemperature,
  subcooledLiquidState,
  superheatedVaporState,
} from './properties'

interface Case {
  name: string
  fluid: RefrigerantId
  evapC: number
  capacityW: number
  refDiameterMm: number
  refLengthM: number
}

const cases: Case[] = [
  {
    name: 'R600a LBP row1',
    fluid: 'R600a',
    evapC: -25,
    capacityW: 70,
    refDiameterMm: 0.66,
    refLengthM: 4.0,
  },
  {
    name: 'R600a LBP row3',
    fluid: 'R600a',
    evapC: -25,
    capacityW: 122.5,
    refDiameterMm: 0.78,
    refLengthM: 3.2,
  },
  {
    name: 'R600a HBP row1',
    fluid: 'R600a',
    evapC: -10,
    capacityW: 312.5,
    refDiameterMm: 0.78,
    refLengthM: 2.5,
  },
  {
    name: 'R134a LBP row1',
    fluid: 'R134a',
    evapC: -30,
    capacityW: 255,
    refDiameterMm: 0.78,
    refLengthM: 3.8,
  },
  {
    name: 'R134a HBP row1',
    fluid: 'R134a',
    evapC: -10,
    capacityW: 312.5,
    refDiameterMm: 0.78,
    refLengthM: 2.5,
  },
  {
    name: 'R134a HBP row5',
    fluid: 'R134a',
    evapC: -10,
    capacityW: 660,
    refDiameterMm: 0.91,
    refLengthM: 2.9,
  },
  {
    name: 'R290 M/HBP row1',
    fluid: 'R290',
    evapC: -12.5,
    capacityW: 375,
    refDiameterMm: 1.06,
    refLengthM: 3.3,
  },
  {
    name: 'R404A LBP row1',
    fluid: 'R404A',
    evapC: -30,
    capacityW: 255,
    refDiameterMm: 0.78,
    refLengthM: 3.8,
  },
]

const massFlowFor = (
  fluid: RefrigerantId,
  evapC: number,
  condC: number,
  capacityW: number,
  subcoolK: number,
  superheatK: number,
) => {
  const evap = saturationAtTemperature(fluid, evapC, 'dew')
  const cond = saturationAtTemperature(fluid, condC, 'bubble')
  const suction = superheatedVaporState(fluid, evap.pressureKPa, evapC + superheatK)
  const liquid = subcooledLiquidState(fluid, cond.pressureKPa, condC - subcoolK)
  const dh = suction.enthalpyKJkg - liquid.enthalpyKJkg
  return {
    massFlowKgS: capacityW / (dh * 1000),
    dh,
    pressureInKPa: cond.pressureKPa,
    pressureOutKPa: evap.pressureKPa,
  }
}

describe('embraco probe', () => {
  it('logs sensitivity to condensing temperature and subcooling', () => {
    const rows: Record<string, unknown>[] = []
    for (const c of cases) {
      for (const condC of [54.4, 45, 40]) {
        for (const subcoolK of [0, 5, 10]) {
          const { massFlowKgS, pressureInKPa, pressureOutKPa } = massFlowFor(
            c.fluid,
            c.evapC,
            condC,
            c.capacityW,
            subcoolK,
            0,
          )
          const operating = {
            fluid: c.fluid,
            pressureInKPa,
            pressureOutKPa,
            subcoolK,
            massFlowKgS,
          }
          const atRef = simulateCapillaryLength(c.refDiameterMm, operating)
          const best = solutions.capillaryIdsMm
            .map((d) => ({ d, sim: simulateCapillaryLength(d, operating) }))
            .filter((x) => x.sim !== null)
            .sort(
              (a, b) =>
                Math.abs(Math.log(a.sim!.lengthM / c.refLengthM)) -
                Math.abs(Math.log(b.sim!.lengthM / c.refLengthM)),
            )[0]
          rows.push({
            case: c.name,
            cond: condC,
            sc: subcoolK,
            refD: c.refDiameterMm,
            refL: c.refLengthM,
            predL: atRef ? +atRef.lengthM.toFixed(2) : null,
            pct: atRef
              ? +(((atRef.lengthM - c.refLengthM) / c.refLengthM) * 100).toFixed(0)
              : null,
            choked: atRef?.choked ?? null,
            bestD: best ? best.d : null,
            bestL: best?.sim ? +best.sim.lengthM.toFixed(2) : null,
          })
        }
      }
    }
     
    console.table(rows)
     
    console.log(JSON.stringify(rows))
  })
})
