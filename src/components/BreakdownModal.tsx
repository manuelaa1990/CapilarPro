import { AlertTriangle, ArrowRight, Beaker, FunctionSquare, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CalculationResult } from '../types'
import { Modal } from './Modal'
import { fmt, fmtKpa, fmtKW } from '../lib/format'
import {
  diameterDigits,
  diameterFromMm,
  fmtFixed,
  lengthDigits,
  lengthFromM,
  type DiameterDisplayUnit,
  type LengthDisplayUnit,
} from '../lib/displayUnits'
import { rpmFromFrequency } from '../engine/frequency'
import { displacementToCubicCentimeters } from '../engine/units'
import { Badge } from './ui'

const FlowStep = ({
  index,
  title,
  children,
}: {
  index: string
  title: string
  children: ReactNode
}) => (
  <div className="relative flex gap-3 pb-5 last:pb-0">
    <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink-900/10 bg-white font-mono text-[10px] font-bold text-ink-800">
      {index}
    </div>
    <div className="absolute bottom-0 left-3.5 top-7 w-px bg-ink-900/10" />
    <div className="min-w-0 flex-1 pt-0.5">
      <h3 className="text-[12px] font-bold text-ink-900">{title}</h3>
      <div className="mt-1.5 text-[11px] leading-relaxed text-ink-600">
        {children}
      </div>
    </div>
  </div>
)

export const BreakdownModal = ({
  result,
  open,
  onClose,
  diameterUnit,
  lengthUnit,
}: {
  result: CalculationResult
  open: boolean
  onClose: () => void
  diameterUnit: DiameterDisplayUnit
  lengthUnit: LengthDisplayUnit
}) => {
  const comp = result.compressor
  const cap = result.capillary
  const diameterDigitsShown = diameterDigits(diameterUnit)
  const diameterUncertaintyDigits =
    diameterDigitsShown + (diameterUnit === 'in' ? 1 : 0)
  const lengthDigitsShown = lengthDigits(lengthUnit)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Trazabilidad del cálculo"
      eyebrow={`${result.fingerprint} · ${result.version}`}
      wide
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="mint">{result.refrigerant.name}</Badge>
        <Badge>{result.input.compressorLabel}</Badge>
        <Badge>
          {fmt(result.input.targetEvapC, 1)} / {fmt(result.input.targetCondC, 1)} °C
        </Badge>
        <Badge tone="amber">
          {fmt(result.uncertainty.totalPct, 0)} % incertidumbre
        </Badge>
      </div>

      <div className="grid gap-3 rounded-2xl bg-frost-50 p-4 sm:grid-cols-4">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-600">
            Capacidad diseño
          </div>
          <div className="mt-1 font-mono text-[16px] font-semibold">
            {fmtKW(comp.capacityW)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-600">
            Caudal másico
          </div>
          <div className="mt-1 font-mono text-[16px] font-semibold">
            {fmt(comp.massFlowKgS * 1000, 2)} g/s
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-600">
            ηv extrapolada
          </div>
          <div className="mt-1 font-mono text-[16px] font-semibold">
            {fmt(comp.etaVolumetricTarget * 100, 1)} %
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-600">
            Capilar
          </div>
          <div className="mt-1 font-mono text-[16px] font-semibold text-mint-700">
            {fmtFixed(diameterFromMm(cap.diameterMm, diameterUnit), diameterDigitsShown)}{' '}
            {diameterUnit} ×{' '}
            {fmtFixed(lengthFromM(cap.lengthM, lengthUnit), lengthDigitsShown)}{' '}
            {lengthUnit}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <FunctionSquare size={15} className="text-mint-700" />
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
            De la placa al capilar
          </h2>
        </div>

        <FlowStep index="01" title="Lectura de la placa del compresor">
          <p>
            La capacidad declarada se ancla al punto real de la etiqueta, no a
            una condición genérica. Para un compresor de 2 polos, RPM = Hz × 60.
          </p>
          <div className="mt-2 grid gap-2 font-mono text-[10px] text-ink-700 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-2.5">
              V̄ = {fmt(result.input.displacement, 2)}{' '}
              {result.input.displacementUnit} →{' '}
              {fmt(
                displacementToCubicCentimeters(
                  result.input.displacement,
                  result.input.displacementUnit,
                ),
                2,
              )}{' '}
              cm³/rev ×{' '}
              {fmt(result.input.frequencyHz, 0)} Hz × 60 ={' '}
              {fmt(rpmFromFrequency(result.input.frequencyHz), 0)} rpm ={' '}
              {fmt(comp.sweptVolumeM3s * 60_000, 3)} L/min
            </div>
            <div className="rounded-lg bg-white p-2.5">
              P<sub>sat</sub> ref ={' '}
              {fmtKpa(result.referenceSaturation.pressureKPa)} ·{' '}
              {fmt(result.input.refEvapC, 1)} °C
            </div>
          </div>
        </FlowStep>

        <FlowStep index="02" title="Eficiencia volumétrica anclada">
          <p>
            Se despeja el volumen nocivo efectivo del punto medido y se conserva
            para el nuevo punto. La extrapolación no inventa una ηv de catálogo.
          </p>
          <div className="mt-2 rounded-lg bg-white p-2.5 font-mono text-[10px] text-ink-700">
            ηv,ref = Q<sub>placa</sub> / (V̄ · ρ<sub>asp</sub> · Δh) ={' '}
            {fmt(comp.rawEtaVolumetricRef * 100, 2)} %
            <br />
            <span className="text-ink-600">
              ηv,ref usada = {fmt(comp.etaVolumetricRef * 100, 2)} % · c ={' '}
              {fmt(comp.clearanceRatio, 4)}
            </span>
            <br />
            <span className="text-mint-700">
              ηv,diseño = 1 − λ − c[(Pd/Ps)^(1/n) − 1] ={' '}
              {fmt(comp.etaVolumetricTarget * 100, 2)} %
            </span>
          </div>
        </FlowStep>

        <FlowStep index="03" title="Extrapolación del punto de trabajo">
          <p>
            Con la densidad de aspiración y el salto entálpico del nuevo punto se
            obtiene el caudal real y la capacidad que el compresor puede mover.
          </p>
          <div className="mt-2 grid gap-2 font-mono text-[10px] text-ink-700 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-2.5">
              ṁ = V̄ · ρ<sub>asp</sub> · ηv ={' '}
              {fmt(comp.massFlowKgS * 1000, 2)} g/s
            </div>
            <div className="rounded-lg bg-white p-2.5">
              Q = ṁ · Δh = {fmtKW(comp.capacityW)} · Δh{' '}
              {fmt(comp.enthalpyDifference, 1)} kJ/kg
            </div>
            <div className="rounded-lg bg-white p-2.5">
              Pd/Ps placa = {fmt(comp.referencePressureRatio, 2)} · diseño ={' '}
              {fmt(comp.targetPressureRatio, 2)}
            </div>
            <div className="rounded-lg bg-white p-2.5">
              ρ<sub>asp</sub> = {fmt(comp.suctionDensity, 2)} kg/m³ · h{' '}
              {fmt(comp.suctionEnthalpy, 1)} kJ/kg
            </div>
          </div>
        </FlowStep>

        <FlowStep index="04" title="Longitud de capilar por integración 1D">
          <p>
            Se integra la pérdida de carga sobre la curva de saturación con la
            calidad local obtenida del balance de energía. Cada diámetro comercial
            se evalúa con el mismo caudal.
          </p>
          <div className="mt-2 grid gap-2 font-mono text-[10px] text-ink-700 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-2.5">
              G = {fmt(cap.massFluxKgM2s, 0)} kg/m²s · u<sub>in</sub> ={' '}
              {fmt(cap.inletVelocityMs, 2)} m/s
            </div>
            <div className="rounded-lg bg-white p-2.5">
              x<sub>salida</sub> = {fmt(cap.outletQuality, 2)} · ΔP ={' '}
              {fmtKpa(cap.pressureDropKPa)}
            </div>
            <div className="rounded-lg bg-white p-2.5">
              D ={' '}
              {fmtFixed(
                diameterFromMm(cap.diameterMm, diameterUnit),
                diameterDigitsShown,
              )}{' '}
              {diameterUnit} · L ={' '}
              {fmtFixed(lengthFromM(cap.lengthM, lengthUnit), lengthDigitsShown)}{' '}
              {lengthUnit}
            </div>
            <div className="rounded-lg bg-white p-2.5">
              Corrección empírica = ×{fmt(cap.correctionFactor, 3)} · n ={' '}
              {result.uncertainty.calibrationSamples}
            </div>
          </div>
        </FlowStep>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50/60 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a5a12]">
          <Beaker size={14} />
          Incertidumbre declarada
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#8a5b28]">
          La barra combina las fuentes de forma cuadrática. La mayor aportación
          sigue siendo el modelo de capilar; la evidencia de campo solo reduce el
          término empírico, nunca la física.
        </p>
        <div className="mt-3 space-y-2">
          {result.uncertainty.contributions.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-[38%] shrink-0 text-[10px] font-medium text-[#7a4c1c]">
                {item.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-900/10">
                <div
                  className="h-full rounded-full bg-[#c47b2b]"
                  style={{
                    width: `${Math.min(100, (item.sigmaPct / 12) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-9 text-right font-mono text-[9px] text-[#9a6a35]">
                {fmt(item.sigmaPct, 1)} %
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-1.5 border-t border-amber-900/10 pt-2.5 text-[10px] text-[#8a5b28]">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>
            Banda de longitud:{' '}
            {fmtFixed(
              lengthFromM(result.uncertainty.interval.lengthM[0], lengthUnit),
              lengthDigitsShown,
            )}
            –
            {fmtFixed(
              lengthFromM(result.uncertainty.interval.lengthM[1], lengthUnit),
              lengthDigitsShown,
            )}{' '}
            {lengthUnit}. Diámetro nominal ±{' '}
            {fmtFixed(
              diameterFromMm(
                (result.uncertainty.interval.diameterMm[1] -
                  result.uncertainty.interval.diameterMm[0]) /
                  2,
                diameterUnit,
              ),
              diameterUncertaintyDigits,
            )}{' '}
            {diameterUnit}.
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-[10px] text-ink-600 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={11} />
          Estimación de ingeniería. Valida con banco o campo antes de producir en serie.
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px]">
          {result.references.properties}
          <ArrowRight size={10} />
        </span>
      </div>
    </Modal>
  )
}
