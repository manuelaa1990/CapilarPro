import slhxConfig from '../data/slhx.json'

export const slhxSuctionTubeDiameters = [
  '1/4',
  '5/16',
  '3/8',
  '1/2',
  '5/8',
  '3/4',
  '7/8',
] as const
export type SlhxSuctionTubeDiameter =
  (typeof slhxSuctionTubeDiameters)[number]

export const slhxSuctionTubeOptions = slhxConfig.suctionTubeOptions
export const isSlhxSuctionTubeDiameter = (
  value: string,
): value is SlhxSuctionTubeDiameter =>
  slhxSuctionTubeDiameters.some((diameter) => diameter === value)

export interface SlhxTransferResult {
  lengthWoundM: number
  epsilonReal: number
  uWm2K: number
  suctionDiameterM: number
  heatTransferPerMassKJkg: number
}

export const calculateSlhxTransfer = ({
  massFlowKgS,
  gasSpecificHeatJKgK,
  inletTemperatureDifferenceK,
  totalCapillaryLengthM,
  windingPercentage,
  suctionTubeDiameter,
}: {
  massFlowKgS: number
  gasSpecificHeatJKgK: number
  inletTemperatureDifferenceK: number
  totalCapillaryLengthM: number
  windingPercentage: number
  suctionTubeDiameter: SlhxSuctionTubeDiameter
}): SlhxTransferResult => {
  const tube = slhxConfig.suctionTubeOptions.find(
    (option) => option.value === suctionTubeDiameter,
  )
  if (!tube) {
    throw new Error(`No hay configuración SLHX para ${suctionTubeDiameter}`)
  }
  if (
    !Number.isFinite(slhxConfig.designEffectiveness) ||
    slhxConfig.designEffectiveness <= 0 ||
    slhxConfig.designEffectiveness >= 1 ||
    !Number.isFinite(tube.uWm2K) ||
    tube.uWm2K <= 0 ||
    !Number.isFinite(tube.diameterM) ||
    tube.diameterM <= 0 ||
    !Number.isFinite(massFlowKgS) ||
    massFlowKgS <= 0 ||
    !Number.isFinite(gasSpecificHeatJKgK) ||
    gasSpecificHeatJKgK <= 0 ||
    !Number.isFinite(inletTemperatureDifferenceK) ||
    !Number.isFinite(totalCapillaryLengthM) ||
    totalCapillaryLengthM < 0 ||
    !Number.isFinite(windingPercentage) ||
    windingPercentage < 30 ||
    windingPercentage > 70
  ) {
    throw new Error('Los parámetros para calcular el SLHX no son válidos')
  }

  const minimumHeatCapacityRate = massFlowKgS * gasSpecificHeatJKgK
  const requiredLengthM =
    (-Math.log(1 - slhxConfig.designEffectiveness) *
      minimumHeatCapacityRate) /
    (tube.uWm2K * Math.PI * tube.diameterM)
  const maximumWoundLengthM =
    totalCapillaryLengthM * (windingPercentage / 100)
  const lengthWoundM = Math.min(requiredLengthM, maximumWoundLengthM)
  const epsilonReal =
    1 -
    Math.exp(
      (-tube.uWm2K * Math.PI * tube.diameterM * lengthWoundM) /
        minimumHeatCapacityRate,
    )
  const heatTransferPerMassKJkg =
    (epsilonReal *
      minimumHeatCapacityRate *
      Math.max(0, inletTemperatureDifferenceK)) /
    massFlowKgS /
    1000

  return {
    lengthWoundM,
    epsilonReal,
    uWm2K: tube.uWm2K,
    suctionDiameterM: tube.diameterM,
    heatTransferPerMassKJkg,
  }
}
