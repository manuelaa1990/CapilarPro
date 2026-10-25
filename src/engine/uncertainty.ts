import { correlations } from '../data/catalog'
import type { UncertaintyContribution, UncertaintyResult } from '../types'

interface UncertaintyInput {
  lengthM: number
  diameterMm: number
  referencePressureRatio: number
  targetPressureRatio: number
  calibrationSamples: number
  capacityAnchored: boolean
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const rss = (values: number[]) =>
  Math.sqrt(values.reduce((total, value) => total + value * value, 0))

const confidenceLabelFor = (
  totalPct: number,
): UncertaintyResult['confidenceLabel'] => {
  const config = correlations.uncertainty
  if (totalPct <= config.highThresholdPct) return 'Alta'
  if (totalPct <= config.goodThresholdPct) return 'Buena'
  if (totalPct <= config.moderateThresholdPct) return 'Moderada'
  return 'Baja'
}

/**
 * Propagación de incertidumbre por suma cuadrática de contribuciones
 * relativas. La incertidumbre del modelo no se oculta: pesa más que la de
 * los datos de placa. Los casos reales del taller reducen el término
 * empírico, nunca la incertidumbre termodinámica de base.
 */
export const estimateUncertainty = ({
  lengthM,
  diameterMm,
  referencePressureRatio,
  targetPressureRatio,
  calibrationSamples,
  capacityAnchored,
}: UncertaintyInput): UncertaintyResult => {
  const config = correlations.uncertainty
  const ratioDistance = Math.abs(
    Math.log(Math.max(1, targetPressureRatio)) -
      Math.log(Math.max(1, referencePressureRatio)),
  )
  const etaExtrapolation =
    config.etaExtrapolationBase + Math.min(0.055, ratioDistance * 0.035)
  const temperatureEffect =
    config.temperature * 2.1 * (1 + Math.min(1, ratioDistance))
  const calibration =
    Math.max(
      config.calibrationMinimum,
      config.calibrationBase / Math.sqrt(1 + calibrationSamples * 1.4),
    )
  const diameterTolerance = config.diameterTolerance * 4.1

  const contributions: UncertaintyContribution[] = [
    {
      id: 'capillary-model',
      label: 'Modelo de capilar',
      sigmaPct: config.capillaryModel * 100,
      note: 'Modelo 1D homogéneo; no reproduce entrada, aceite ni rebabas.',
    },
    {
      id: 'capacity',
      label: 'Capacidad de placa',
      sigmaPct: config.nameplateCapacity * 100,
      note: 'Tolerancia de catálogo y punto de ensayo declarado.',
    },
    {
      id: 'eta',
      label: 'Extrapolación de ηv',
      sigmaPct: etaExtrapolation * 100,
      note: 'Distancia entre la relación de presiones de placa y la de diseño.',
    },
    {
      id: 'diameter',
      label: 'Tolerancia de diámetro',
      sigmaPct: diameterTolerance,
      note: 'La longitud escala de forma aproximada con D⁻⁴.',
    },
    {
      id: 'calibration',
      label: 'Evidencia de campo',
      sigmaPct: calibration * 100,
      note:
        calibrationSamples > 0
          ? `${calibrationSamples} caso(s) con longitud real reducen este término.`
          : 'Sin casos validados: se usa la incertidumbre empírica base.',
    },
    {
      id: 'temperature',
      label: 'Medición de temperaturas',
      sigmaPct: temperatureEffect,
      note: 'Resolución de instrumentación y estabilidad del punto.',
    },
    {
      id: 'displacement',
      label: 'Desplazamiento / RPM',
      sigmaPct: Math.sqrt(
        config.displacement ** 2 + config.rpm ** 2,
      ) * 100,
      note: 'Datos de placa y variación de velocidad del compresor.',
    },
    {
      id: 'properties',
      label: 'Propiedades termofísicas',
      sigmaPct: config.properties * 100,
      note: 'Tablas CoolProp HEOS interpoladas a 1 K.',
    },
  ]

  if (!capacityAnchored) {
    contributions.push({
      id: 'anchor',
      label: 'Anclaje de capacidad',
      sigmaPct: 9,
      note: 'La eficiencia volumétrica de referencia quedó fuera de rango.',
    })
  }

  const capacityPct = rss([
    config.nameplateCapacity * 100,
    config.displacement * 100,
    config.rpm * 100,
    config.properties * 100,
    etaExtrapolation * 100,
    temperatureEffect,
  ])
  const totalPct = rss(contributions.map((item) => item.sigmaPct))
  const safeTotal = clamp(totalPct, 5, 45)
  const confidenceScore = clamp(Math.round(100 - safeTotal * 2.6), 30, 95)
  const lengthFraction = safeTotal / 100

  return {
    totalPct: safeTotal,
    capacityPct,
    lengthPct: safeTotal,
    confidenceScore,
    confidenceLabel: confidenceLabelFor(safeTotal),
    contributions: contributions.sort((a, b) => b.sigmaPct - a.sigmaPct),
    interval: {
      diameterMm: [diameterMm - 0.025, diameterMm + 0.025],
      lengthM: [
        Math.max(0.05, lengthM * (1 - lengthFraction)),
        lengthM * (1 + lengthFraction),
      ],
    },
    calibrationSamples,
    method: 'Propagación RSS de 8 fuentes + evidencia local',
  }
}
