import {
  ArrowUpRight,
  BookmarkCheck,
  Check,
  ChevronRight,
  CircleAlert,
  Gauge,
  Info,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Waves,
} from 'lucide-react'
import clsx from 'clsx'
import type {
  CalculationResult,
  CalibrationSummary,
  MemorySuggestion,
} from '../types'
import { Badge } from './ui'
import { UnitToggle } from './UnitToggle'
import { fmt, fmtKW } from '../lib/format'
import {
  diameterDigits,
  diameterFromMm,
  fmtFixed,
  lengthDigits,
  lengthFromM,
  type DiameterDisplayUnit,
  type LengthDisplayUnit,
} from '../lib/displayUnits'

const DIAMETER_UNITS: ReadonlyArray<{
  value: DiameterDisplayUnit
  label: string
}> = [
  { value: 'mm', label: 'mm' },
  { value: 'in', label: 'in' },
]

const LENGTH_UNITS: ReadonlyArray<{
  value: LengthDisplayUnit
  label: string
}> = [
  { value: 'm', label: 'm' },
  { value: 'cm', label: 'cm' },
  { value: 'in', label: 'in' },
]

const ConfidencePill = ({
  result,
}: {
  result: CalculationResult
}) => {
  const label = result.uncertainty.confidenceLabel
  const tone =
    label === 'Alta'
      ? 'bg-mint-400/20 text-mint-300 border-mint-400/20'
      : label === 'Buena'
        ? 'bg-sky-400/15 text-sky-200 border-sky-300/20'
        : label === 'Moderada'
          ? 'bg-ember-400/15 text-ember-400 border-ember-400/20'
          : 'bg-red-400/15 text-red-300 border-red-400/20'
  return (
    <span
      className={clsx(
        'rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]',
        tone,
      )}
    >
      {label}
    </span>
  )
}

const Coil = ({ diameterMm }: { diameterMm: number }) => {
  const stroke = Math.max(2.2, Math.min(7.5, diameterMm * 2.8))
  return (
    <svg
      viewBox="0 0 220 88"
      className="h-[78px] w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="coil-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="#ffb45c" />
          <stop offset="0.3" stopColor="#7ee8d2" />
          <stop offset="1" stopColor="#40d7bd" />
        </linearGradient>
        <filter id="coil-glow" x="-40%" y="-80%" width="180%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M8 24h92c17 0 17 22 0 22H45c-17 0-17 20 0 20h90c25 0 25-28 0-28h-32"
        fill="none"
        stroke="rgba(255,255,255,.07)"
        strokeWidth={stroke + 8}
        strokeLinecap="round"
      />
      <path
        className="coil-path"
        d="M8 24h92c17 0 17 22 0 22H45c-17 0-17 20 0 20h90c25 0 25-28 0-28h-32"
        fill="none"
        stroke="url(#coil-gradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        filter="url(#coil-glow)"
      />
      <circle cx="8" cy="24" r="3" fill="#ffb45c" />
      <circle cx="195" cy="38" r="3" fill="#40d7bd" />
    </svg>
  )
}

const PrecisionBar = ({
  result,
  lengthUnit,
}: {
  result: CalculationResult
  lengthUnit: LengthDisplayUnit
}) => {
  const uncertainty = result.uncertainty
  const digits = lengthDigits(lengthUnit)
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-white/60">
          <ShieldCheck size={12} className="text-mint-400" />
          Precisión estimada
        </div>
        <ConfidencePill result={result} />
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="font-mono text-[21px] font-semibold leading-none text-white">
          ± {fmt(uncertainty.totalPct, 0)} %
        </div>
        <div className="text-right text-[10px] leading-tight text-white/60">
          Longitud
          <br />
          <span className="font-mono text-white/65">
            {fmtFixed(lengthFromM(uncertainty.interval.lengthM[0], lengthUnit), digits)}–
            {fmtFixed(lengthFromM(uncertainty.interval.lengthM[1], lengthUnit), digits)}{' '}
            {lengthUnit}
          </span>
        </div>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="absolute inset-0 flex">
          <div className="h-full w-[25%] bg-red-400/30" />
          <div className="h-full w-[20%] bg-ember-400/30" />
          <div className="h-full w-[22%] bg-sky-400/25" />
          <div className="h-full flex-1 bg-mint-400/25" />
        </div>
        <div
          className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,.6)]"
          style={{ left: `calc(${Math.min(97, uncertainty.confidenceScore)}% - 2px)` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[8px] uppercase tracking-wider text-white/60">
        <span>Modelo</span>
        <span>Datos</span>
        <span>Validado</span>
      </div>
    </div>
  )
}

const Metric = ({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Gauge
  label: string
  value: string
  sub?: string
}) => (
  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/60">
      <Icon size={11} />
      {label}
    </div>
    <div className="mt-1 font-mono text-[15px] font-medium leading-none text-white/90">
      {value}
    </div>
    {sub && <div className="mt-1 text-[9px] text-white/60">{sub}</div>}
  </div>
)

const AlternativeRow = ({
  candidate,
  recommended,
  diameterUnit,
  lengthUnit,
}: {
  candidate: CalculationResult['capillary']['alternatives'][number]
  recommended: boolean
  diameterUnit: DiameterDisplayUnit
  lengthUnit: LengthDisplayUnit
}) => (
  <div
    className={clsx(
      'flex items-center gap-2 rounded-lg px-2 py-1.5',
      recommended ? 'bg-mint-400/10' : 'hover:bg-white/[0.04]',
    )}
  >
    <span
      className={clsx(
        'h-1.5 w-1.5 shrink-0 rounded-full',
        candidate.status === 'short' || candidate.status === 'long'
          ? 'bg-ember-400/70'
          : 'bg-mint-400',
      )}
    />
    <span className="font-mono text-[11px] text-white/70">
      {fmtFixed(
        diameterFromMm(candidate.diameterMm, diameterUnit),
        diameterDigits(diameterUnit),
      )}{' '}
      {diameterUnit}
      <span className="text-white/60"> × </span>
      {fmtFixed(lengthFromM(candidate.lengthM, lengthUnit), lengthDigits(lengthUnit))}{' '}
      {lengthUnit}
    </span>
    <span
      className={clsx(
        'ml-auto rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide',
        candidate.status === 'short'
          ? 'bg-ember-400/10 text-ember-400/80'
          : candidate.status === 'long'
            ? 'bg-sky-400/10 text-sky-300/70'
            : 'bg-white/[0.06] text-white/60',
      )}
    >
      {candidate.status === 'short'
        ? 'corto'
        : candidate.status === 'long'
          ? 'largo'
          : 'viable'}
    </span>
  </div>
)

export const ResultCard = ({
  result,
  currentSaved,
  onSave,
  onShowDetails,
  suggestion,
  calibration,
  diameterUnit,
  lengthUnit,
  onDiameterUnitChange,
  onLengthUnitChange,
}: {
  result: CalculationResult
  currentSaved: boolean
  onSave: () => void
  onShowDetails: () => void
  suggestion: MemorySuggestion | null
  calibration: CalibrationSummary
  diameterUnit: DiameterDisplayUnit
  lengthUnit: LengthDisplayUnit
  onDiameterUnitChange: (unit: DiameterDisplayUnit) => void
  onLengthUnitChange: (unit: LengthDisplayUnit) => void
}) => {
  const capillary = result.capillary
  const primary = {
    ...capillary,
    rawLengthM: capillary.lengthM / Math.max(capillary.correctionFactor, 0.1),
    status: 'recommended' as const,
    note: '',
  }
  const alternatives = [primary, ...capillary.alternatives].slice(0, 4)

  return (
    <div className="overflow-hidden rounded-[24px] bg-ink-950 text-white shadow-float">
      <div className="relative overflow-hidden bg-instrument-grid bg-[size:22px_22px] px-5 pb-4 pt-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-mint-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-ember-400/[0.07] blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-mint-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-mint-400" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-300" />
              </span>
              Recomendación primaria
            </div>
            <span className="font-mono text-[9px] tracking-wider text-white/60">
              {result.fingerprint}
            </span>
          </div>

          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[46px] font-semibold leading-none tracking-[-0.06em] text-white">
                  {fmtFixed(
                    diameterFromMm(capillary.diameterMm, diameterUnit),
                    diameterDigits(diameterUnit),
                  )}
                </span>
                <UnitToggle
                  label="Unidad del diámetro"
                  options={DIAMETER_UNITS}
                  value={diameterUnit}
                  onChange={onDiameterUnitChange}
                  className="self-center"
                />
                <span className="font-mono text-[11px] font-medium text-white/60">
                  ID
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-display text-[29px] font-semibold leading-none tracking-[-0.04em] text-mint-300">
                  {fmtFixed(
                    lengthFromM(capillary.lengthM, lengthUnit),
                    lengthDigits(lengthUnit),
                  )}
                </span>
                <UnitToggle
                  label="Unidad de la longitud"
                  options={LENGTH_UNITS}
                  value={lengthUnit}
                  onChange={onLengthUnitChange}
                />
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  longitud
                </span>
              </div>
            </div>
            <div className="w-[44%] max-w-[210px] self-end">
              <Coil diameterMm={capillary.diameterMm} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="dark">
              <Thermometer size={10} />
              {fmt(result.input.targetEvapC, 1)} °C evaporación
            </Badge>
            <Badge tone="dark">
              {fmt(result.input.targetCondC, 1)} °C condensación
            </Badge>
            {capillary.selectedIsInstalled && (
              <Badge tone="mint" className="border-mint-400/20 bg-mint-400/10 text-mint-300">
                <Check size={10} />
                coincide con instalado
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 pb-5 pt-4">
        <PrecisionBar result={result} lengthUnit={lengthUnit} />

        <div className="grid grid-cols-2 gap-2">
          <Metric
            icon={Gauge}
            label="Capacidad"
            value={fmtKW(result.compressor.capacityW)}
            sub={`ηv ${fmt(result.compressor.etaVolumetricTarget * 100, 1)} %`}
          />
          <Metric
            icon={Waves}
            label="Caudal"
            value={`${fmt(result.compressor.massFlowKgS * 1000, 1)} g/s`}
            sub={`G ${fmt(capillary.massFluxKgM2s, 0)} kg/m²s`}
          />
          <Metric
            icon={CircleAlert}
            label="Pd / Ps"
            value={fmt(result.compressor.targetPressureRatio, 2)}
            sub={`placa ${fmt(result.compressor.referencePressureRatio, 2)}`}
          />
          <Metric
            icon={Thermometer}
            label="Calidad salida"
            value={fmt(capillary.outletQuality, 2)}
            sub="0 = líquido · 1 = vapor"
          />
        </div>

        <div className="rounded-2xl border border-white/[0.07] p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/60">
              Otras combinaciones
            </span>
            <span className="font-mono text-[8px] text-white/60">
              ventana {fmtFixed(lengthFromM(0.35, lengthUnit), lengthDigits(lengthUnit))}
              –{fmtFixed(lengthFromM(4.5, lengthUnit), lengthDigits(lengthUnit))}{' '}
              {lengthUnit}
            </span>
          </div>
          <div className="space-y-0.5">
            {alternatives.map((candidate, index) => (
              <AlternativeRow
                key={`${candidate.diameterMm}-${index}`}
                candidate={candidate}
                recommended={candidate.status === 'recommended'}
                diameterUnit={diameterUnit}
                lengthUnit={lengthUnit}
              />
            ))}
          </div>
        </div>

        {calibration.adjusted && (
          <div className="flex items-start gap-2 rounded-xl border border-mint-400/15 bg-mint-400/[0.06] px-3 py-2">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-mint-300" />
            <div className="text-[10px] leading-relaxed text-mint-100/70">
              Longitud ajustada{' '}
              <span className="font-mono text-mint-300">
                {calibration.factor >= 1 ? '+' : ''}
                {fmt((calibration.factor - 1) * 100, 1)} %
              </span>{' '}
              por {calibration.samples} caso(s) de campo.
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onSave} className="btn-mint flex-1">
            {currentSaved ? (
              <>
                <BookmarkCheck size={16} />
                Guardado
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Guardar y aprender
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onShowDetails}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Ver desglose técnico"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {suggestion && (
          <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3 text-[10px] text-white/60">
            <Info size={12} className="shrink-0" />
            <span>
              Memoria local sugiere{' '}
              {fmtFixed(
                diameterFromMm(suggestion.diameterMm, diameterUnit),
                diameterDigits(diameterUnit),
              )}{' '}
              {diameterUnit} ×{' '}
              {fmtFixed(
                lengthFromM(suggestion.lengthM, lengthUnit),
                lengthDigits(lengthUnit),
              )}{' '}
              {lengthUnit}
            </span>
            <button
              type="button"
              onClick={onShowDetails}
              className="ml-auto inline-flex items-center gap-1 text-mint-300/70 hover:text-mint-300"
            >
              ver
              <ArrowUpRight size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
