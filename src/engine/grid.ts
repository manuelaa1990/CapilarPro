import type { CapillaryCandidate } from '../types'

interface RankOptions {
  designLengthM: number
  minViableLengthM: number
  maxViableLengthM: number
  preferredDiameterMm?: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const isViable = (candidate: CapillaryCandidate, options: RankOptions) =>
  candidate.lengthM >= options.minViableLengthM &&
  candidate.lengthM <= options.maxViableLengthM

const scoreCandidate = (candidate: CapillaryCandidate, options: RankOptions) => {
  const safeLength = Math.max(candidate.lengthM, 0.01)
  const lengthDistance = Math.abs(Math.log(safeLength / options.designLengthM))
  const outsideRange =
    candidate.lengthM < options.minViableLengthM
      ? (options.minViableLengthM - candidate.lengthM) /
        options.minViableLengthM
      : candidate.lengthM > options.maxViableLengthM
        ? (candidate.lengthM - options.maxViableLengthM) /
          options.maxViableLengthM
        : 0
  const diameterBalance = candidate.diameterMm < 0.55 ? 0.22 : 0
  return lengthDistance + outsideRange * 2.4 + diameterBalance
}

const noteFor = (
  candidate: CapillaryCandidate,
  options: RankOptions,
): Pick<CapillaryCandidate, 'status' | 'note'> => {
  if (candidate.lengthM < options.minViableLengthM) {
    return {
      status: 'short',
      note: 'Muy corto: alta sensibilidad a rebabas y tolerancia de diámetro.',
    }
  }
  if (candidate.lengthM > options.maxViableLengthM) {
    return {
      status: 'long',
      note: 'Largo: mayor pérdida de carga y más superficie de intercambio.',
    }
  }
  return {
    status: 'alternative',
    note: 'Dentro de la ventana de fabricación recomendada.',
  }
}

export const rankCandidates = (
  candidates: CapillaryCandidate[],
  options: RankOptions,
): CapillaryCandidate[] => {
  if (candidates.length === 0) return []
  const ranked = [...candidates].sort(
    (a, b) => {
      if (options.preferredDiameterMm !== undefined) {
        const aPreferred =
          a.diameterMm === options.preferredDiameterMm && isViable(a, options)
        const bPreferred =
          b.diameterMm === options.preferredDiameterMm && isViable(b, options)
        if (aPreferred !== bPreferred) return aPreferred ? -1 : 1
      }
      return scoreCandidate(a, options) - scoreCandidate(b, options)
    },
  )
  return ranked.map((candidate, index) => {
    const base = noteFor(candidate, options)
    if (index === 0) {
      if (base.status === 'alternative') {
        return {
          ...candidate,
          status: 'recommended',
          note: 'Mejor equilibrio entre longitud, diámetro y tolerancias.',
        }
      }
      return {
        ...candidate,
        status: base.status,
        note: `${base.note} Se elige por ser la opción menos desfavorable.`,
      }
    }
    return { ...candidate, ...base }
  })
}

export const candidateQuality = (
  candidate: CapillaryCandidate,
  options: RankOptions,
): number =>
  clamp(100 - scoreCandidate(candidate, options) * 55, 0, 100)
