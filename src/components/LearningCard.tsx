import { ArrowRight, BrainCircuit, Database, Sparkles } from 'lucide-react'
import type { CalibrationSummary, LearnedModel } from '../types'
import { fmt } from '../lib/format'
import { useApp } from '../store/useApp'

export const LearningCard = ({
  learned,
  calibration,
}: {
  learned: LearnedModel
  calibration: CalibrationSummary
}) => {
  const { navigate, settings } = useApp()
  const suggestion = learned.suggestion

  return (
    <section className="panel mt-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-900/[0.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ember-500/10 text-[#a55a10]">
            <BrainCircuit size={13} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-700">
            Memoria de taller
          </span>
        </div>
        <span className="flex items-center gap-1 font-mono text-[9px] text-ink-600">
          <Database size={9} />
          {learned.totalCases}
        </span>
      </div>

      <div className="p-4">
        {!settings.learningEnabled ? (
          <p className="text-[11px] leading-relaxed text-ink-600">
            El aprendizaje local está desactivado. Puedes activarlo en Ajustes
            para usar tus casos validados.
          </p>
        ) : suggestion ? (
          <>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint-500/10 text-mint-700">
                <Sparkles size={14} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mint-700">
                  Antes de terminar
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-600">
                  {suggestion.label}. Tu historial apunta a:
                </p>
                <p className="mt-1.5 font-mono text-[19px] font-semibold tracking-[-0.03em] text-ink-950">
                  {fmt(suggestion.diameterMm, 2)} mm
                  <span className="mx-1 text-frost-300">×</span>
                  {fmt(suggestion.lengthM, 2)} m
                </p>
                <div className="mt-1 flex items-center gap-2 text-[9px] text-ink-600">
                  <span>{suggestion.sampleCount} caso(s)</span>
                  <span className="h-0.5 w-0.5 rounded-full bg-frost-300" />
                  <span>similitud {fmt(suggestion.similarity * 100, 0)} %</span>
                </div>
              </div>
            </div>
            <div className="my-3 h-px bg-ink-900/[0.06]" />
          </>
        ) : (
          <>
            <p className="text-[11px] leading-relaxed text-ink-600">
              Aún no hay patrones repetidos para este equipo. Guarda casos y,
              sobre todo, registra la longitud real instalada.
            </p>
            <div className="my-3 h-px bg-ink-900/[0.06]" />
          </>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-600">
              Ajuste empírico
            </p>
            <p className="mt-1 font-mono text-[14px] font-semibold text-ink-950">
              {calibration.adjusted
                ? `${calibration.factor >= 1 ? '+' : ''}${fmt((calibration.factor - 1) * 100, 1)} %`
                : 'Sin ajuste'}
            </p>
            <p className="mt-0.5 text-[9px] text-ink-600">
              {calibration.samples > 0
                ? `${calibration.samples} caso(s) con longitud real`
                : 'Se activa con 2 casos reales'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('history')}
            className="btn-ghost"
          >
            Historial
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </section>
  )
}
