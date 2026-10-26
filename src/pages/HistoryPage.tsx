import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CircleDashed,
  Download,
  FileUp,
  FlaskConical,
  History,
  PencilLine,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import type { SavedCase } from '../types'
import { saturationAtTemperature } from '../engine/properties'
import { predictLengthForDiameter } from '../engine/capillary'
import { fmt, fmtDate, fmtDateTime, fmtKW } from '../lib/format'
import { useApp } from '../store/useApp'
import { Badge, Card } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { Modal } from '../components/Modal'
import { BreakdownModal } from '../components/BreakdownModal'

type Filter = 'all' | 'validated' | 'pending'

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

const StatCard = ({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  detail: string
  tone?: 'default' | 'mint' | 'amber'
}) => (
  <div
    className={clsx(
      'rounded-2xl border p-4',
      tone === 'mint'
        ? 'border-mint-500/20 bg-mint-500/[0.06]'
        : tone === 'amber'
          ? 'border-ember-500/20 bg-ember-500/[0.055]'
          : 'border-ink-900/[0.07] bg-white',
    )}
  >
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-600">
      {label}
    </p>
    <p className="mt-2 font-display text-[27px] font-semibold leading-none tracking-[-0.04em] text-ink-950">
      {value}
    </p>
    <p className="mt-1.5 text-[10px] leading-tight text-ink-600">{detail}</p>
  </div>
)

const EmptyHistory = ({
  onDemo,
  onCalculate,
}: {
  onDemo: () => void
  onCalculate: () => void
}) => (
  <div className="relative overflow-hidden rounded-[24px] border border-dashed border-ink-900/15 bg-white/60 px-6 py-14 text-center">
    <div className="absolute inset-0 bg-instrument-grid bg-[size:22px_22px] opacity-[0.035]" />
    <div className="relative mx-auto max-w-md">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-950 text-mint-300 shadow-lg">
        <History size={27} />
      </div>
      <p className="eyebrow mt-5">Memoria vacía</p>
      <h2 className="mt-2 font-display text-[27px] font-semibold tracking-[-0.04em]">
        Tu taller empieza a aprender hoy
      </h2>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-600">
        Guarda cálculos y registra la longitud real del capilar instalado.
        CapilarPro usa esos residuos para corregir futuras recomendaciones, sin
        enviar nada a ningún servidor.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onDemo} className="btn-primary">
          <FlaskConical size={14} />
          Cargar 3 casos de demostración
        </button>
        <button type="button" onClick={onCalculate} className="btn-secondary">
          Calcular un caso real
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  </div>
)

const ActualModal = ({
  item,
  open,
  onClose,
  onSave,
}: {
  item: SavedCase | null
  open: boolean
  onClose: () => void
  onSave: (
    id: string,
    value: {
      diameterMm: number
      lengthM: number
      measuredEvapC: number | null
      measuredCapacityW: number | null
      notes: string
    },
  ) => void
}) => {
  const [diameter, setDiameter] = useState('')
  const [length, setLength] = useState('')
  const [evap, setEvap] = useState('')
  const [capacity, setCapacity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!item) return
    const actual = item.actual
    setDiameter(
      String(
        actual?.diameterMm ??
          item.result.input.installedDiameterMm ??
          item.result.capillary.diameterMm,
      ),
    )
    setLength(
      String(
        actual?.lengthM ??
          item.result.input.installedLengthM ??
          Number(item.result.capillary.lengthM.toFixed(2)),
      ),
    )
    setEvap(actual?.measuredEvapC !== null && actual?.measuredEvapC !== undefined ? String(actual.measuredEvapC) : '')
    setCapacity(
      actual?.measuredCapacityW !== null && actual?.measuredCapacityW !== undefined
        ? String(actual.measuredCapacityW)
        : '',
    )
    setNotes(actual?.notes ?? '')
    setError('')
  }, [item, open])

  const diameterNumber = Number.parseFloat(diameter)
  const lengthNumber = Number.parseFloat(length)

  const modelLength = useMemo(() => {
    if (!item || !Number.isFinite(diameterNumber) || diameterNumber <= 0) return null
    try {
      const input = item.result.input
      const high = saturationAtTemperature(
        input.refrigerantId,
        input.targetCondC,
        'bubble',
      ).pressureKPa
      const low = saturationAtTemperature(
        input.refrigerantId,
        input.targetEvapC,
        'dew',
      ).pressureKPa
      return predictLengthForDiameter(
        input,
        item.result.compressor.massFlowKgS,
        high,
        low,
        diameterNumber,
      )
    } catch {
      return null
    }
  }, [item, diameterNumber])

  const deviation =
    modelLength && Number.isFinite(lengthNumber) && modelLength > 0
      ? ((lengthNumber - modelLength) / modelLength) * 100
      : null

  const submit = () => {
    if (!item) return
    if (!Number.isFinite(diameterNumber) || diameterNumber < 0.3 || diameterNumber > 3.5) {
      setError('Introduce un diámetro interior válido entre 0,3 y 3,5 mm.')
      return
    }
    if (!Number.isFinite(lengthNumber) || lengthNumber < 0.1 || lengthNumber > 10) {
      setError('Introduce una longitud real válida entre 0,1 y 10 m.')
      return
    }
    onSave(item.id, {
      diameterMm: diameterNumber,
      lengthM: lengthNumber,
      measuredEvapC: evap.trim() === '' ? null : Number.parseFloat(evap),
      measuredCapacityW:
        capacity.trim() === '' ? null : Number.parseFloat(capacity),
      notes: notes.trim(),
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar evidencia real"
      eyebrow={item ? item.result.input.compressorLabel : 'Caso'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            <Check size={14} />
            Guardar evidencia
          </button>
        </>
      }
    >
      {item && (
        <>
          <div className="rounded-xl bg-frost-50 p-3 text-[11px] leading-relaxed text-ink-600">
            <span className="font-semibold text-ink-900">
              {item.result.refrigerant.name}
            </span>{' '}
            · {fmt(item.result.input.targetEvapC, 1)} /{' '}
            {fmt(item.result.input.targetCondC, 1)} °C · modelo{' '}
            <span className="font-mono">
              {fmt(item.result.capillary.diameterMm, 2)} ×{' '}
              {fmt(item.result.capillary.lengthM, 2)} m
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="actual-diameter">
                Diámetro interior real
              </label>
              <div className="input-shell">
                <input
                  id="actual-diameter"
                  type="number"
                  step="0.01"
                  value={diameter}
                  onChange={(event) => setDiameter(event.target.value)}
                  className="input-base"
                />
                <span className="border-l border-ink-900/10 px-3 text-[10px] font-bold text-ink-600">
                  mm
                </span>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="actual-length">
                Longitud real
              </label>
              <div className="input-shell">
                <input
                  id="actual-length"
                  type="number"
                  step="0.01"
                  value={length}
                  onChange={(event) => setLength(event.target.value)}
                  className="input-base"
                />
                <span className="border-l border-ink-900/10 px-3 text-[10px] font-bold text-ink-600">
                  m
                </span>
              </div>
            </div>
          </div>

          {modelLength !== null && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-ink-900/[0.07] bg-white px-3 py-2.5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-600">
                  Modelo para ese diámetro
                </p>
                <p className="mt-0.5 font-mono text-[15px] font-semibold text-ink-950">
                  {fmt(modelLength, 2)} m
                </p>
              </div>
              {deviation !== null && (
                <Badge tone={Math.abs(deviation) < 12 ? 'mint' : 'amber'}>
                  {deviation >= 0 ? '+' : ''}
                  {fmt(deviation, 1)} % vs modelo
                </Badge>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="actual-evap">
                Evaporación medida
              </label>
              <div className="input-shell">
                <input
                  id="actual-evap"
                  type="number"
                  step="0.1"
                  placeholder="Opcional"
                  value={evap}
                  onChange={(event) => setEvap(event.target.value)}
                  className="input-base"
                />
                <span className="border-l border-ink-900/10 px-3 text-[10px] font-bold text-ink-600">
                  °C
                </span>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="actual-capacity">
                Capacidad medida / estimada
              </label>
              <div className="input-shell">
                <input
                  id="actual-capacity"
                  type="number"
                  step="1"
                  placeholder="Opcional"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  className="input-base"
                />
                <span className="border-l border-ink-900/10 px-3 text-[10px] font-bold text-ink-600">
                  W
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="field-label" htmlFor="actual-notes">
              Notas de campo
            </label>
            <textarea
              id="actual-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Presiones, aceite, filtro, condiciones de la prueba…"
              className="w-full resize-none rounded-xl border border-ink-900/10 bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
              {error}
            </p>
          )}

          <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-ink-600">
            <Sparkles size={12} className="mt-0.5 shrink-0 text-mint-700" />
            La longitud real es la evidencia más valiosa. Con dos casos para el
            mismo refrigerante, el modelo aplica una corrección robusta por
            mediana de residuos.
          </p>
        </>
      )}
    </Modal>
  )
}

export const HistoryPage = () => {
  const {
    cases,
    learned,
    deleteCase,
    recordActual,
    loadDemoCases,
    exportAll,
    importAll,
    navigate,
  } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [actualCase, setActualCase] = useState<SavedCase | null>(null)
  const [detailsCase, setDetailsCase] = useState<SavedCase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedCase | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(null), 4200)
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return cases.filter((item) => {
      const hasActual = Boolean(item.actual?.lengthM)
      if (filter === 'validated' && !hasActual) return false
      if (filter === 'pending' && hasActual) return false
      if (!normalized) return true
      return [
        item.result.input.compressorLabel,
        item.result.refrigerant.name,
        item.result.input.notes,
        item.actual?.notes,
        item.result.input.targetEvapC.toFixed(1),
        item.result.input.targetCondC.toFixed(1),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    })
  }, [cases, query, filter])

  const validated = cases.filter((item) => item.actual?.lengthM)
  const deviations = validated
    .map((item) => {
      if (!item.actual?.lengthM || !item.actual.modeledLengthAtActualM) return null
      return (
        ((item.actual.lengthM - item.actual.modeledLengthAtActualM) /
          item.actual.modeledLengthAtActualM) *
        100
      )
    })
    .filter((value): value is number => value !== null && Number.isFinite(value))
  const medianDeviation = median(deviations)
  const averageUncertainty =
    cases.length > 0
      ? cases.reduce((sum, item) => sum + item.result.uncertainty.totalPct, 0) /
        cases.length
      : 0
  const refrigerantsUsed = new Set(
    cases.map((item) => item.result.input.refrigerantId),
  ).size

  const runImport = async (file: File) => {
    try {
      const result = await importAll(file)
      showToast(
        result.received === 0
          ? 'El archivo no contiene casos.'
          : `${result.received} caso(s) importados · ${result.duplicates} duplicado(s) omitidos.`,
      )
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se pudo importar el archivo.',
      )
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Memoria de taller"
        title={
          <>
            Cada caso real hace que el
            <br className="hidden sm:block" /> modelo sea tuyo.
          </>
        }
        description="Tus cálculos y validaciones viven solo en este navegador. Registra la longitud instalada, la evaporación medida o la capacidad real; el modelo corregirá su sesgo con esos residuos."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={exportAll}>
              <Download size={14} />
              Exportar
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp size={14} />
              Importar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void runImport(file)
              }}
            />
          </div>
        }
      />

      {cases.length === 0 ? (
        <EmptyHistory
          onDemo={() => {
            const count = loadDemoCases()
            showToast(`${count} casos de demostración cargados.`)
          }}
          onCalculate={() => navigate('calculator')}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Cálculos"
              value={String(cases.length)}
              detail={`${refrigerantsUsed} refrigerante(s) · ${learned.totalCases} en el modelo`}
            />
            <StatCard
              label="Validados"
              value={String(validated.length)}
              detail={
                validated.length >= 2
                  ? 'Evidencia suficiente para corregir sesgo'
                  : `Faltan ${Math.max(0, 2 - validated.length)} para ajuste empírico`
              }
              tone="mint"
            />
            <StatCard
              label="Desviación mediana"
              value={
                deviations.length > 0
                  ? `${medianDeviation >= 0 ? '+' : ''}${fmt(medianDeviation, 1)} %`
                  : '—'
              }
              detail="Longitud real frente al modelo previo"
              tone="amber"
            />
            <StatCard
              label="Precisión media"
              value={`± ${fmt(averageUncertainty, 0)} %`}
              detail="Incertidumbre declarada de la longitud"
            />
          </div>

          <div className="mt-5 rounded-2xl border border-mint-500/20 bg-mint-500/[0.055] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-500/15 text-mint-700">
                <BookOpenCheck size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-ink-900">
                  {learned.calibration.adjusted
                    ? `El modelo está corrigiendo un ${learned.calibration.factor >= 1 ? '+' : ''}${fmt((learned.calibration.factor - 1) * 100, 1)} % de longitud`
                    : 'Aún no hay suficiente evidencia para corregir el modelo'}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-ink-600">
                  {learned.calibration.adjusted
                    ? `${learned.calibration.samples} caso(s) con longitud real · alcance ${learned.calibration.scope === 'refrigerant' ? 'por refrigerante' : 'global'}.`
                    : 'Registra al menos dos longitudes reales. La contracción bayesiana evita que un caso aislado secuestre la recomendación.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-ink-900/10">
                  <div
                    className="h-full rounded-full bg-mint-500 transition-all"
                    style={{
                      width: `${Math.min(100, (validated.length / 8) * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-mono text-[9px] text-ink-600">
                  {validated.length}/8
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px] flex-1 sm:max-w-xs">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar equipo, R290, notas…"
                className="w-full rounded-xl border border-ink-900/10 bg-white py-2.5 pl-9 pr-3 text-[12px] outline-none transition-all focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10"
              />
            </div>
            <div className="flex rounded-xl border border-ink-900/10 bg-white p-1">
              {(
                [
                  ['all', 'Todos'],
                  ['validated', 'Validados'],
                  ['pending', 'Pendientes'],
                ] as Array<[Filter, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors',
                    filter === id
                      ? 'bg-ink-950 text-white'
                      : 'text-ink-600 hover:bg-ink-900/5',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[10px] text-ink-600">
              {filtered.length} de {cases.length}
            </span>
          </div>

          <Card className="mt-3 overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-ink-900/[0.07] bg-frost-50/70">
                    {['Caso', 'Punto de diseño', 'Recomendación', 'Evidencia', ''].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-ink-600"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const hasActual = Boolean(item.actual?.lengthM)
                    const deviation =
                      item.actual?.lengthM && item.actual?.modeledLengthAtActualM
                        ? ((item.actual.lengthM -
                            item.actual.modeledLengthAtActualM) /
                            item.actual.modeledLengthAtActualM) *
                          100
                        : null
                    return (
                      <tr
                        key={item.id}
                        className="group border-b border-ink-900/[0.05] transition-colors last:border-0 hover:bg-frost-50/70"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-start gap-2.5">
                            <span
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: item.result.refrigerant.color,
                              }}
                            />
                            <div>
                              <p className="text-[11px] font-bold text-ink-900">
                                {item.result.input.compressorLabel}
                              </p>
                              <p className="mt-0.5 text-[9px] text-ink-600">
                                {fmtDate(item.createdAt)} · {item.result.refrigerant.name}
                                {item.source === 'demo' && ' · demo'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-[11px] font-medium text-ink-800">
                            {fmt(item.result.input.targetEvapC, 1)} /{' '}
                            {fmt(item.result.input.targetCondC, 1)} °C
                          </p>
                          <p className="mt-0.5 text-[9px] text-ink-600">
                            {fmtKW(item.result.compressor.capacityW)} · Pd/Ps{' '}
                            {fmt(item.result.compressor.targetPressureRatio, 2)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-[12px] font-semibold text-ink-950">
                            {fmt(item.result.capillary.diameterMm, 2)} mm ×{' '}
                            {fmt(item.result.capillary.lengthM, 2)} m
                          </p>
                          <p className="mt-0.5 text-[9px] text-ink-600">
                            ± {fmt(item.result.uncertainty.totalPct, 0)} % ·{' '}
                            {item.result.uncertainty.confidenceLabel}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          {hasActual ? (
                            <div>
                              <Badge tone="mint">
                                <CheckCircle2 size={10} /> Validado
                              </Badge>
                              <p className="mt-1 text-[9px] text-ink-600">
                                real {fmt(item.actual!.lengthM!, 2)} m
                                {deviation !== null && (
                                  <>
                                    {' '}· {deviation >= 0 ? '+' : ''}
                                    {fmt(deviation, 1)} %
                                  </>
                                )}
                              </p>
                            </div>
                          ) : (
                            <Badge tone="neutral">
                              <CircleDashed size={10} /> Pendiente
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailsCase(item)}
                              className="btn-ghost"
                              aria-label="Ver desglose del caso"
                            >
                              <BookOpenCheck size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setActualCase(item)}
                              className="rounded-lg p-1.5 text-ink-600 transition-colors hover:bg-mint-500/10 hover:text-mint-700"
                              aria-label="Registrar evidencia real"
                            >
                              <PencilLine size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="rounded-lg p-1.5 text-ink-600 transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label="Eliminar caso"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-ink-900/[0.06] md:hidden">
              {filtered.map((item) => {
                const hasActual = Boolean(item.actual?.lengthM)
                return (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-bold">
                          {item.result.input.compressorLabel}
                        </p>
                        <p className="mt-0.5 text-[9px] text-ink-600">
                          {fmtDate(item.createdAt)} · {item.result.refrigerant.name}
                        </p>
                      </div>
                      <Badge tone={hasActual ? 'mint' : 'neutral'}>
                        {hasActual ? 'validado' : 'pendiente'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-frost-50 px-3 py-2.5">
                      <span className="font-mono text-[11px] text-ink-700">
                        {fmt(item.result.input.targetEvapC, 1)} /{' '}
                        {fmt(item.result.input.targetCondC, 1)} °C
                      </span>
                      <span className="font-mono text-[12px] font-semibold">
                        {fmt(item.result.capillary.diameterMm, 2)} ×{' '}
                        {fmt(item.result.capillary.lengthM, 2)} m
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary flex-1 py-2 text-[11px]"
                        onClick={() => setActualCase(item)}
                      >
                        <PencilLine size={12} />
                        Evidencia
                      </button>
                      <button
                        type="button"
                        className="btn-secondary py-2"
                        onClick={() => setDetailsCase(item)}
                        aria-label="Ver desglose"
                      >
                        <BookOpenCheck size={13} />
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-ink-900/10 px-3 text-ink-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteTarget(item)}
                        aria-label="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Search size={22} className="mx-auto text-frost-300" />
                <p className="mt-3 text-[12px] font-semibold text-ink-800">
                  Ningún caso coincide con el filtro
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                  }}
                  className="mt-2 text-[10px] font-semibold text-mint-700 hover:underline"
                >
                  Limpiar búsqueda
                </button>
              </div>
            )}
          </Card>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] text-ink-600">
            <span className="flex items-center gap-1.5">
              <History size={12} />
              Última actividad:{' '}
              {cases[0] ? fmtDateTime(cases[0].updatedAt) : '—'}
            </span>
            <button
              type="button"
              onClick={() => {
                const count = loadDemoCases()
                showToast(`${count} casos de demostración cargados.`)
              }}
              className="inline-flex items-center gap-1.5 font-semibold text-ink-600 hover:text-ink-950"
            >
              <FlaskConical size={12} />
              Añadir casos demo
            </button>
          </div>
        </>
      )}

      <ActualModal
        item={actualCase}
        open={Boolean(actualCase)}
        onClose={() => setActualCase(null)}
        onSave={(id, value) => {
          recordActual(id, value)
          showToast('Evidencia registrada. El modelo local se ha vuelto a ajustar.')
        }}
      />

      {detailsCase && (
        <BreakdownModal
          result={detailsCase.result}
          open
          onClose={() => setDetailsCase(null)}
        />
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar este caso"
        eyebrow="Historial local"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) {
                  deleteCase(deleteTarget.id)
                  showToast('Caso eliminado de la memoria local.')
                }
                setDeleteTarget(null)
              }}
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          </>
        }
      >
        <p className="text-[12px] leading-relaxed text-ink-600">
          Se eliminará el cálculo y su evidencia de campo. Si era uno de tus casos
          validados, el ajuste empírico se recalculará sin él.
        </p>
        {deleteTarget && (
          <div className="mt-3 rounded-xl bg-frost-50 p-3 text-[11px]">
            <p className="font-semibold text-ink-900">
              {deleteTarget.result.input.compressorLabel}
            </p>
            <p className="mt-0.5 font-mono text-ink-600">
              {fmt(deleteTarget.result.input.targetEvapC, 1)} /{' '}
              {fmt(deleteTarget.result.input.targetCondC, 1)} °C ·{' '}
              {fmt(deleteTarget.result.capillary.diameterMm, 2)} ×{' '}
              {fmt(deleteTarget.result.capillary.lengthM, 2)} m
            </p>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-full bg-ink-950 px-4 py-2.5 text-[11px] font-semibold text-white shadow-float lg:bottom-8">
          {toast.startsWith('No ') || toast.includes('válido') ? (
            <X size={14} className="shrink-0 text-red-300" />
          ) : (
            <Check size={14} className="shrink-0 text-mint-300" />
          )}
          {toast}
        </div>
      )}
    </div>
  )
}
