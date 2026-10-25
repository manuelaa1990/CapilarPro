import { correlations } from '../data/catalog'
import type {
  CalibrationSummary,
  CalculationInput,
  LearnedModel,
  MemorySuggestion,
  RefrigerantId,
  SavedCase,
} from '../types'

interface CalibrationEntry {
  refrigerantId: RefrigerantId
  logResidual: number
  weight: number
  createdAt: string
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const recencyWeight = (createdAt: string) => {
  const ageDays = Math.max(
    0,
    (Date.now() - new Date(createdAt).getTime()) / 86_400_000,
  )
  return Math.pow(
    0.5,
    ageDays / Math.max(1, correlations.learning.recencyHalfLifeDays),
  )
}

const weightedMedian = (entries: CalibrationEntry[]): number => {
  const sorted = [...entries].sort((a, b) => a.logResidual - b.logResidual)
  const total = sorted.reduce((sum, entry) => sum + entry.weight, 0)
  let cumulative = 0
  for (const entry of sorted) {
    cumulative += entry.weight
    if (cumulative >= total / 2) return entry.logResidual
  }
  return sorted.at(-1)?.logResidual ?? 0
}

const emptyCalibration = (): CalibrationSummary => ({
  factor: 1,
  samples: 0,
  scope: 'none',
  medianDeviationPct: 0,
  adjusted: false,
})

const calibrationFromEntries = (
  entries: CalibrationEntry[],
  scope: CalibrationSummary['scope'],
): CalibrationSummary => {
  const learning = correlations.learning
  if (entries.length < learning.minimumCalibrationSamples) {
    return {
      ...emptyCalibration(),
      samples: entries.length,
      scope,
    }
  }
  const median = weightedMedian(entries)
  const clipped = clamp(median, -learning.maxAbsLogCorrection, learning.maxAbsLogCorrection)
  const shrink = entries.length / (entries.length + learning.shrinkagePrior)
  const factor = Math.exp(clipped * shrink)
  return {
    factor: clamp(factor, 0.75, 1.25),
    samples: entries.length,
    scope,
    medianDeviationPct: (Math.exp(median) - 1) * 100,
    adjusted: true,
  }
}

const calibrationEntries = (cases: SavedCase[]): CalibrationEntry[] =>
  cases.flatMap((item) => {
    const actual = item.actual
    if (!actual?.lengthM || !actual.modeledLengthAtActualM) return []
    if (actual.lengthM <= 0 || actual.modeledLengthAtActualM <= 0) return []
    const logResidual = Math.log(actual.lengthM / actual.modeledLengthAtActualM)
    if (!Number.isFinite(logResidual) || Math.abs(logResidual) > 0.7) return []
    return [
      {
        refrigerantId: item.result.input.refrigerantId,
        logResidual,
        weight: recencyWeight(item.updatedAt),
        createdAt: item.updatedAt,
      },
    ]
  })

/**
 * Aprendizaje local: corrige la longitud con la mediana de los residuos
 * logarítmicos de los casos con longitud real. La contracción bayesiana
 * evita que dos casos aislados secuestren el modelo.
 */
export const getCalibration = (
  cases: SavedCase[],
  refrigerantId: RefrigerantId,
  learningEnabled: boolean,
): CalibrationSummary => {
  if (!learningEnabled) return emptyCalibration()
  const entries = calibrationEntries(cases)
  if (entries.length === 0) return emptyCalibration()

  const byRefrigerant = entries.filter(
    (entry) => entry.refrigerantId === refrigerantId,
  )
  const refrigerantCalibration = calibrationFromEntries(
    byRefrigerant,
    'refrigerant',
  )
  if (
    refrigerantCalibration.adjusted &&
    byRefrigerant.length >= correlations.learning.minimumRefrigerantSamples
  ) {
    return refrigerantCalibration
  }

  const globalCalibration = calibrationFromEntries(entries, 'global')
  if (globalCalibration.adjusted) return globalCalibration
  return {
    ...globalCalibration,
    scope: byRefrigerant.length > 0 ? 'refrigerant' : 'global',
  }
}

const similarityFor = (item: SavedCase, input: CalculationInput): number => {
  const caseInput = item.result.input
  let score = 0
  if (caseInput.refrigerantId === input.refrigerantId) score += 0.34
  else return 0
  if (caseInput.compressorId === input.compressorId) score += 0.26
  score +=
    0.18 *
    Math.exp(-Math.abs(caseInput.targetEvapC - input.targetEvapC) / 12)
  score +=
    0.12 *
    Math.exp(-Math.abs(caseInput.targetCondC - input.targetCondC) / 15)
  if (item.actual) score += 0.1
  return score
}

const weightedGeometricMean = (values: Array<{ value: number; weight: number }>) => {
  const total = values.reduce((sum, item) => sum + item.weight, 0)
  if (total <= 0) return 0
  return Math.exp(
    values.reduce(
      (sum, item) => sum + Math.log(Math.max(item.value, 0.001)) * item.weight,
      0,
    ) / total,
  )
}

/**
 * Recomendación antes de completar el formulario: busca los casos más
 * parecidos por refrigerante, compresor y puntos de evaporación/condensación.
 */
export const getMemorySuggestion = (
  cases: SavedCase[],
  input: CalculationInput,
  learningEnabled: boolean,
): MemorySuggestion | null => {
  const learning = correlations.learning
  if (!learningEnabled || cases.length === 0) return null

  const ranked = cases
    .map((item) => ({ item, score: similarityFor(item, input) }))
    .filter(({ score }) => score >= learning.minimumSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, learning.maxSimilarCases)

  if (ranked.length === 0) return null

  const diameter = weightedGeometricMean(
    ranked.map(({ item, score }) => ({
      value: item.result.capillary.diameterMm,
      weight: score * recencyWeight(item.updatedAt),
    })),
  )
  const length = weightedGeometricMean(
    ranked.map(({ item, score }) => ({
      value: item.result.capillary.lengthM,
      weight: score * recencyWeight(item.updatedAt),
    })),
  )
  const averageSimilarity =
    ranked.reduce((sum, item) => sum + item.score, 0) / ranked.length

  return {
    diameterMm: Math.round(diameter * 20) / 20,
    lengthM: Math.round(length * 20) / 20,
    sampleCount: ranked.length,
    similarity: averageSimilarity,
    label:
      ranked.length >= 3
        ? 'Patrón repetido en tu taller'
        : ranked.length === 2
          ? 'Dos casos comparables'
          : 'Un caso similar',
    refrigerantId: input.refrigerantId,
    lastSeen: ranked
      .map(({ item }) => item.updatedAt)
      .sort()
      .at(-1)!,
  }
}

export const computeLearnedModel = (
  cases: SavedCase[],
  input: CalculationInput,
  learningEnabled: boolean,
): LearnedModel => {
  const calibration = getCalibration(
    cases,
    input.refrigerantId,
    learningEnabled,
  )
  const byRefrigerant: Partial<Record<RefrigerantId, CalibrationSummary>> = {}
  const refrigerants = new Set(
    cases.map((item) => item.result.input.refrigerantId),
  )
  for (const refrigerant of refrigerants) {
    const summary = getCalibration(cases, refrigerant, learningEnabled)
    if (summary.samples > 0 && summary.scope === 'refrigerant') {
      byRefrigerant[refrigerant] = summary
    }
  }

  return {
    calibration,
    byRefrigerant,
    suggestion: getMemorySuggestion(cases, input, learningEnabled),
    actualCases: cases.filter((item) => item.actual?.lengthM).length,
    totalCases: cases.length,
  }
}

export const calibrationForCase = (
  cases: SavedCase[],
  item: SavedCase,
): CalibrationSummary =>
  getCalibration(cases, item.result.input.refrigerantId, true)
