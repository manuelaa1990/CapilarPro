import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CircleAlert,
  CircleCheck,
  Database,
  Gauge,
  Info,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Thermometer,
} from 'lucide-react'
import clsx from 'clsx'
import type {
  CalculationInput,
  CalculationResult,
  CalculationWarning,
  CapacityNormalization,
  CapacityUnit,
  CompressorApplication,
  DisplacementUnit,
  RefrigerantId,
  StandardId,
} from '../types'
import { compressors, refrigerantById, refrigerants, standards } from '../data/catalog'
import { fluidLimits, saturationAtTemperature } from '../engine/properties'
import type { SaturationPhase } from '../engine/properties'
import { fmt, fmtKW } from '../lib/format'
import type {
  DiameterDisplayUnit,
  LengthDisplayUnit,
} from '../lib/displayUnits'
import {
  BTU_PER_HOUR_PER_WATT,
  CUBIC_CENTIMETERS_PER_CUBIC_INCH,
  convertCapacity,
  convertDisplacement,
} from '../engine/units'
import { useApp } from '../store/useApp'
import { inputLimits } from '../store/schemas'
import { Badge, Card, NumberField, SectionHeading, SelectField } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { ResultCard } from '../components/ResultCard'
import { BreakdownModal } from '../components/BreakdownModal'
import { CompressorSearch } from '../components/CompressorSearch'
import { deriveReferenceSuperheatAndSubcooling } from '../engine/standards'
import {
  isSlhxSuctionTubeDiameter,
  slhxSuctionTubeOptions,
} from '../engine/slhx'

const pressureAt = (
  refrigerantId: RefrigerantId,
  temperatureC: number,
  phase: SaturationPhase,
) => {
  try {
    return saturationAtTemperature(refrigerantId, temperatureC, phase).pressureKPa
  } catch {
    return 0
  }
}

const WarningList = ({ warnings }: { warnings: CalculationWarning[] }) => {
  if (!warnings || warnings.length === 0) return null
  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning.code}
          className={clsx(
            'flex gap-2.5 rounded-xl border px-3.5 py-2.5',
            warning.severity === 'critical'
              ? 'border-red-200 bg-red-50'
              : warning.severity === 'warning'
                ? 'border-amber-200/80 bg-amber-50/70'
                : 'border-sky-200/70 bg-sky-50/60',
          )}
        >
          {warning.severity === 'info' ? (
            <Info size={14} className="mt-0.5 shrink-0 text-sky-600" />
          ) : (
            <AlertTriangle
              size={14}
              className={clsx(
                'mt-0.5 shrink-0',
                warning.severity === 'warning' ? 'text-amber-600' : 'text-red-600',
              )}
            />
          )}
          <div>
            <p className="text-[11px] font-bold text-ink-900">{warning.title}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-ink-600">
              {warning.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

const CapacityConversionBanner = ({
  normalization,
  application,
  unit,
  result,
}: {
  normalization: CapacityNormalization
  application: CompressorApplication
  unit: CapacityUnit
  result: CalculationResult | null
}) => {
  const refrigerantChanged = normalization.method === 'refrigerant-change'
  const conditionChanged = normalization.ratioUsed !== 1
  const designRefrigerant = normalization.designRefrigerant
  const requiredRefrigerant = normalization.requiredRefrigerant

  if (!refrigerantChanged && !conditionChanged) {
    return (
      <div
        role="status"
        className="mt-4 flex items-start gap-3 rounded-2xl border border-ink-900/[0.08] bg-frost-50/70 px-4 py-3"
      >
        <CircleCheck size={16} className="mt-0.5 shrink-0 text-mint-700" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-700">
            Sin conversión
          </p>
          <p className="mt-1 text-[11px] font-semibold text-ink-800">
            Condición de diseño: {normalization.declaredApplication} ·{' '}
            {designRefrigerant} → Condición requerida: {application} ·{' '}
            {requiredRefrigerant}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-600">
            Misma condición y refrigerante: la capacidad declarada se usa como
            ancla directa del punto de placa.
          </p>
        </div>
      </div>
    )
  }

  if (refrigerantChanged) {
    const declaredCapacity = convertCapacity(
      normalization.originalCapacityW,
      'W',
      unit,
    )
    const calculatedCapacity = result
      ? convertCapacity(result.compressor.capacityW, 'W', unit)
      : null

    return (
      <div
        role="status"
        className="mt-4 flex items-start gap-3 rounded-2xl border border-ember-500/25 bg-ember-500/10 px-4 py-3"
      >
        <RefreshCw size={16} className="mt-0.5 shrink-0 text-[#a55a10]" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a55a10]">
            Balance de capacidad
          </p>
          <p className="mt-1 text-[11px] font-semibold text-ink-800">
            Condición de diseño: {normalization.declaredApplication} ·{' '}
            {designRefrigerant} → Condición requerida: {application} ·{' '}
            {requiredRefrigerant}
          </p>
          <p className="mt-1 font-mono text-[12px] leading-relaxed text-ink-800">
            {fmt(declaredCapacity, 0)} {unit} →{' '}
            {calculatedCapacity === null
              ? 'recalculando…'
              : `${fmt(calculatedCapacity, 0)} ${unit}`}
          </p>
          {result && (
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-700">
              ηv {fmt(result.compressor.etaVolumetricRef * 100, 1)} % →{' '}
              {fmt(result.compressor.etaVolumetricTarget * 100, 1)} % · ρ{' '}
              {fmt(result.compressor.suctionDensity, 2)} kg/m³ · caudal{' '}
              {fmt(result.compressor.massFlowKgS * 1000, 1)} g/s
            </p>
          )}
          <p className="mt-1 text-[10px] leading-relaxed text-ink-600">
            Sin factor empírico: se recalculan propiedades, densidad de succión,
            relación de presiones, ηv, caudal másico y capacidad con{' '}
            {requiredRefrigerant}. El ancla de ηv permanece en el punto de placa
            con {designRefrigerant}.
          </p>
        </div>
      </div>
    )
  }

  const originalCapacity = convertCapacity(
    normalization.originalCapacityW,
    'W',
    unit,
  )
  const normalizedCapacity = convertCapacity(
    normalization.capacityW,
    'W',
    unit,
  )

  return (
    <div
      role="status"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-mint-500/25 bg-mint-500/10 px-4 py-3"
    >
      <CircleCheck size={16} className="mt-0.5 shrink-0 text-mint-700" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mint-700">
          Conversión de placa
        </p>
        <p className="mt-1 text-[11px] font-semibold text-ink-800">
          Condición de diseño: {normalization.declaredApplication} → Condición
          requerida: {application}
        </p>
        <p className="mt-1 font-mono text-[12px] leading-relaxed text-ink-800">
          Capacidad de placa: {fmt(originalCapacity, 0)} {unit} ×{' '}
          {normalization.ratioUsed.toFixed(2)} ={' '}
          {fmt(normalizedCapacity, 0)} {unit}
        </p>
        {normalization.method === 'physics' && (
          <p className="mt-1 text-[10px] leading-relaxed text-ink-600">
            Factor derivado de la densidad de succión y el salto entálpico
            (ρ·Δh) de cada régimen; sin factor empírico fijo.
          </p>
        )}
      </div>
    </div>
  )
}

export const CalculatorPage = () => {
  const {
    input,
    result,
    calculationError,
    chooseCompressor,
    chooseRefrigerant,
    chooseRequiredRefrigerant,
    chooseStandard,
    chooseDesignApplication,
    chooseApplication,
    updateInput,
    dismissError,
  } = useApp()
  const [showDetails, setShowDetails] = useState(false)
  const [manualReferenceValues, setManualReferenceValues] = useState(false)
  const [diameterUnit, setDiameterUnit] = useState<DiameterDisplayUnit>('in')
  const [lengthUnit, setLengthUnit] = useState<LengthDisplayUnit>('m')

  const compressor = compressors.find((item) => item.id === input.compressorId)
  const standard = standards.find((item) => item.id === input.standardId) ?? standards[0]
  const refrigerant = refrigerantById(input.refrigerantId)
  const requiredRefrigerantId =
    input.requiredRefrigerantId ?? input.refrigerantId
  const requiredRefrigerant = refrigerantById(requiredRefrigerantId)
  const refrigerantChanged = requiredRefrigerantId !== input.refrigerantId
  const designRefrigerantLimits = fluidLimits(input.refrigerantId)
  const requiredRefrigerantLimits = fluidLimits(requiredRefrigerantId)
  const targetPressure = useMemo(
    () => pressureAt(requiredRefrigerantId, input.targetEvapC, 'dew'),
    [requiredRefrigerantId, input.targetEvapC],
  )
  const condPressure = useMemo(
    () => pressureAt(requiredRefrigerantId, input.targetCondC, 'bubble'),
    [requiredRefrigerantId, input.targetCondC],
  )
  const ratio =
    targetPressure > 0 ? condPressure / targetPressure : result?.compressor.targetPressureRatio ?? 0

  const resetPlate = () => {
    if (!compressor) return
    chooseCompressor(compressor.id)
  }

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Dimensionado de capilares"
        title={
          <>
            Del dato de placa al capilar
            <br className="hidden sm:block" /> que realmente necesita el sistema.
          </>
        }
        description="No partimos de una capacidad nominal genérica: anclamos la eficiencia volumétrica al punto real del compresor, extrapolamos con física y declaramos la incertidumbre."
        action={
          <div className="hidden flex-col items-end gap-2 sm:flex">
            <div className="flex items-center gap-2 rounded-full border border-ink-900/10 bg-white px-3 py-1.5 text-[10px] font-semibold text-ink-600 shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-mint-500" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-500" />
              </span>
              Motor local listo
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-600">
              CP-HEM-1.0 · {refrigerant.name}
              {refrigerantChanged ? ` → ${requiredRefrigerant.name}` : ''}
            </span>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge>
          <Layers3 size={11} />
          ASHRAE / AHRI 540
        </Badge>
        <Badge>
          <Database size={11} />
          CoolProp HEOS
        </Badge>
      </div>

      {calculationError && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <CircleAlert size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-[12px] font-bold text-red-900">
              No se pudo cerrar el cálculo
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-red-700">
              {calculationError}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissError}
            className="text-[10px] font-bold uppercase tracking-wide text-red-500 hover:text-red-700"
          >
            Ocultar
          </button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:gap-6">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="p-5 sm:p-6">
              <SectionHeading
                number="01"
                eyebrow="Bloque A"
                title="Condición de diseño"
                description="Refrigerante, régimen y capacidad declarada en placa. Desde aquí se ancla la eficiencia volumétrica del compresor."
                right={
                  <div className="flex items-center gap-3">
                    {compressor ? (
                      <Badge tone="amber">{compressor.application}</Badge>
                    ) : (
                      <Badge>Personalizado</Badge>
                    )}
                    <div className="hidden text-right sm:block">
                      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-600">
                        ηv anclada
                      </div>
                      <div className="mt-1 font-mono text-[18px] font-semibold text-mint-700">
                        {result
                          ? `${fmt(result.compressor.etaVolumetricRef * 100, 1)} %`
                          : '—'}
                      </div>
                    </div>
                  </div>
                }
              />

              <div className="mt-5">
                <CompressorSearch
                  compressors={compressors}
                  value={input.compressorLabel}
                  onValueChange={(compressorLabel) =>
                    updateInput({ compressorId: 'custom', compressorLabel })
                  }
                  onSelectCompressor={(id) => {
                    setManualReferenceValues(false)
                    chooseCompressor(id)
                  }}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Refrigerante de diseño"
                  value={input.refrigerantId}
                  onChange={(value) => chooseRefrigerant(value as RefrigerantId)}
                  tip="Refrigerante con el que se declara la capacidad de placa y se ancla la eficiencia volumétrica."
                >
                  {refrigerants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label="Condición de diseño"
                  value={input.declaredApplication ?? input.application}
                  onChange={(value) =>
                    chooseDesignApplication(value as CompressorApplication)
                  }
                  tip="Régimen de fábrica o estándar del compresor en el que se declara la capacidad de placa (LBP, MBP, CBP o HBP). Define las temperaturas de referencia del bloque de diseño."
                >
                  <option value="LBP">LBP (congelación)</option>
                  <option value="MBP">MBP (refrigeración)</option>
                  <option value="CBP">CBP (comercial media-alta)</option>
                  <option value="HBP">HBP (alta)</option>
                </SelectField>
              </div>

              {compressor && (
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-ink-900/[0.06] bg-frost-50 px-3.5 py-2.5 text-[10px] text-ink-600">
                  <span className="flex items-center gap-1.5 font-semibold text-ink-800">
                    <Gauge size={12} />
                    {compressor.brand} {compressor.model}
                  </span>
                  <span className="font-mono">
                    {fmt(compressor.displacementCm3Rev, 2)} cm³/rev
                  </span>
                  <span className="font-mono">{fmtKW(compressor.ratedCapacityW)}</span>
                  <span className="ml-auto text-[9px] text-ink-600">
                    {compressor.source}
                  </span>
                </div>
              )}

              {refrigerant.glideK >= 0.25 && (
                <p
                  role="status"
                  className="mt-2 text-[11px] font-medium text-amber-700"
                >
                  ⚠️ Mezcla zeotrópica. Cargar siempre en fase líquida.
                </p>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-4">
                    <NumberField
                      label="Capacidad declarada"
                      value={input.ratedCapacity}
                      onChange={(value) => updateInput({ ratedCapacity: value })}
                      unit=""
                      trailing={
                        <select
                          aria-label="Unidad de capacidad"
                          value={input.capacityUnit}
                          onChange={(event) => {
                            const capacityUnit = event.target.value as CapacityUnit
                            updateInput({
                              ratedCapacity: convertCapacity(
                                input.ratedCapacity,
                                input.capacityUnit,
                                capacityUnit,
                              ),
                              capacityUnit,
                            })
                          }}
                          className="h-full shrink-0 border-l border-ink-900/10 bg-transparent px-3 text-[11px] font-bold text-ink-700 outline-none focus:bg-mint-50"
                        >
                          <option value="W">W</option>
                          <option value="BTU/h">BTU/h</option>
                        </select>
                      }
                      min={
                        input.capacityUnit === 'W'
                          ? 20
                          : 20 * BTU_PER_HOUR_PER_WATT
                      }
                      max={
                        input.capacityUnit === 'W'
                          ? 250000
                          : 250000 * BTU_PER_HOUR_PER_WATT
                      }
                      step={input.capacityUnit === 'W' ? 5 : 10}
                      tip="Capacidad de refrigeración publicada por el fabricante en el punto de la etiqueta."
                    />
                  </div>
                  <NumberField
                    label="Desplazamiento"
                    value={input.displacement}
                    onChange={(value) => updateInput({ displacement: value })}
                    unit=""
                    trailing={
                      <select
                        aria-label="Unidad de desplazamiento"
                        value={input.displacementUnit}
                        onChange={(event) => {
                          const displacementUnit = event.target.value as DisplacementUnit
                          updateInput({
                            displacement: convertDisplacement(
                              input.displacement,
                              input.displacementUnit,
                              displacementUnit,
                            ),
                            displacementUnit,
                          })
                        }}
                        className="h-full shrink-0 border-l border-ink-900/10 bg-transparent px-3 text-[11px] font-bold text-ink-700 outline-none focus:bg-mint-50"
                      >
                        <option value="cm³/rev">cm³/rev</option>
                        <option value="in³/rev">in³/rev</option>
                      </select>
                    }
                    min={
                      input.displacementUnit === 'cm³/rev'
                        ? 0.2
                        : 0.2 / CUBIC_CENTIMETERS_PER_CUBIC_INCH
                    }
                    max={
                      input.displacementUnit === 'cm³/rev'
                        ? 3000
                        : 3000 / CUBIC_CENTIMETERS_PER_CUBIC_INCH
                    }
                    step={input.displacementUnit === 'cm³/rev' ? 0.1 : 0.01}
                    tip="Volumen geométrico barrido por revolución. Está en la placa o en el catálogo técnico."
                  />
                  <div>
                    <label className="field-label" htmlFor="frequency-hz">
                      Frecuencia de red
                    </label>
                    <div className="input-shell">
                      <select
                        id="frequency-hz"
                        value={String(input.frequencyHz)}
                        onChange={(event) =>
                          updateInput({ frequencyHz: Number(event.target.value) })
                        }
                        className="h-full w-full appearance-none bg-transparent px-3.5 py-2.5 text-[13px] font-medium text-ink-950 outline-none"
                      >
                        <option value="60">60 Hz (3600 RPM)</option>
                        <option value="50">50 Hz (3000 RPM)</option>
                      </select>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-600">
                      Compresor hermético estándar de 2 polos.
                    </p>
                  </div>
              </div>

              <div className="mt-4">
                <SelectField
                  label="Estándar de ensayo"
                  value={input.standardId}
                  onChange={(value) => {
                    setManualReferenceValues(false)
                    chooseStandard(value as StandardId)
                  }}
                  hint={standard.shortName === 'Personalizada' ? 'Define el punto exacto abajo.' : standard.reference}
                >
                  {standards.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </SelectField>
              </div>

              {input.declaredApplication &&
                input.declaredApplication !== input.application && (
                  <p
                    role="status"
                    className="mt-3 flex items-start gap-1.5 rounded-lg border border-sky-200/70 bg-sky-50/70 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-sky-800"
                  >
                    <Info
                      size={12}
                      className="mt-0.5 shrink-0 text-sky-600"
                    />
                    {refrigerantChanged
                      ? 'Cambio de condición y refrigerante: el motor ancla ηv en el punto de diseño y recalcula el punto requerido con las propiedades del refrigerante requerido.'
                      : input.declaredApplication === 'CBP' ||
                          input.application === 'CBP'
                        ? `La capacidad de placa se convierte de ${input.declaredApplication} a ${input.application} con ρ·Δh del refrigerante, sin factor empírico fijo. El motor ancla ηv en el diseño.`
                        : `La capacidad de placa se convierte de ${input.declaredApplication} a ${input.application}; el motor ancla ηv en el diseño y extrapola al punto requerido.`}
                  </p>
                )}

              <div className="mt-4 rounded-2xl border border-ink-900/[0.06] bg-frost-50/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-700">
                    <Thermometer size={12} />
                    Estándar de ensayo
                    </div>
                    <p className="mt-1 text-[10px] text-ink-600">
                      Los valores se asignan según el estándar y la condición de diseño seleccionados.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[9px] text-ink-600">
                    {input.declaredApplication ?? input.application} · {standard.shortName} · {fmt(input.refEvapC, 1)} / {fmt(input.refCondC, 1)} °C
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <NumberField
                    label="Evap. referencia"
                    value={input.refEvapC}
                    onChange={(value) =>
                      updateInput({
                        refEvapC: value,
                        ...deriveReferenceSuperheatAndSubcooling({
                          ...input,
                          refEvapC: value,
                        }),
                        standardId: 'custom',
                      })
                    }
                    unit="°C"
                    min={Math.max(-65, designRefrigerantLimits.minC)}
                    max={30}
                    step={0.1}
                    inputClassName="py-2 text-[13px]"
                  />
                  <NumberField
                    label="Cond. referencia"
                    value={input.refCondC}
                    onChange={(value) =>
                      updateInput({
                        refCondC: value,
                        ...deriveReferenceSuperheatAndSubcooling({
                          ...input,
                          refCondC: value,
                        }),
                        standardId: 'custom',
                      })
                    }
                    unit="°C"
                    min={20}
                    max={Math.min(67, designRefrigerantLimits.maxC)}
                    step={0.1}
                    inputClassName="py-2 text-[13px]"
                  />
                  <NumberField
                    label="Temp. Ambiente"
                    value={input.ambientTempC}
                    onChange={(value) => {
                      updateInput({
                        ambientTempC: value,
                        ...deriveReferenceSuperheatAndSubcooling({
                          ...input,
                          ambientTempC: value,
                        }),
                        standardId: 'custom',
                      })
                    }}
                    unit="°C"
                    min={-65}
                    max={67}
                    step={0.1}
                    inputClassName="py-2 text-[13px]"
                  />
                  <NumberField
                    label="Temp. Retorno"
                    value={input.returnGasTempC}
                    onChange={(value) => {
                      updateInput({
                        returnGasTempC: value,
                        ...deriveReferenceSuperheatAndSubcooling({
                          ...input,
                          returnGasTempC: value,
                        }),
                        standardId: 'custom',
                      })
                    }}
                    unit="°C"
                    min={-65}
                    max={100}
                    step={0.1}
                    inputClassName="py-2 text-[13px]"
                  />
                  <NumberField
                    label="Recalentamiento"
                    value={input.refSuperheatK}
                    onChange={(value) => updateInput({ refSuperheatK: value, standardId: 'custom' })}
                    unit="K"
                    min={0}
                    max={200}
                    step={0.1}
                    readOnly={!manualReferenceValues}
                    inputClassName="py-2 text-[13px]"
                  />
                  <NumberField
                    label="Subenfriamiento"
                    value={input.refSubcoolK}
                    onChange={(value) => updateInput({ refSubcoolK: value, standardId: 'custom' })}
                    unit="K"
                    min={0}
                    max={100}
                    step={0.1}
                    readOnly={!manualReferenceValues}
                    inputClassName="py-2 text-[13px]"
                  />
                </div>
                <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-600">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  {manualReferenceValues
                    ? 'Editando valores personalizados. El estándar no se aplicará a estos campos.'
                    : 'Valores calculados según el estándar. Modificar solo si la hoja técnica del compresor especifica condiciones de ensayo diferentes.'}
                </p>
                <button
                  type="button"
                  className="btn-ghost mt-1 text-[10px]"
                  aria-pressed={manualReferenceValues}
                  onClick={() =>
                    setManualReferenceValues((editable) => !editable)
                  }
                >
                  {manualReferenceValues
                    ? 'Usar valores calculados'
                    : '¿Tienes otros datos? Editar manualmente'}
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5 sm:p-6">
              <SectionHeading
                number="02"
                eyebrow="Bloque B"
                title="Condición requerida"
                description="Refrigerante y régimen de operación que debe cubrir el sistema. Si el fluido difiere del diseño, el motor recalcula densidad, ηv, caudal y capacidad con el refrigerante requerido."
                right={
                  <div
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-ink-900/10 bg-slate-100 px-2.5 py-1 text-[9px] leading-none text-ink-700 shadow-sm"
                    title="Relación de Compresión: Presión de descarga / Presión de succión. Indica el esfuerzo del compresor."
                    aria-label="Relación de Compresión: Presión de descarga / Presión de succión. Indica el esfuerzo del compresor."
                  >
                    <span className="font-bold uppercase tracking-[0.12em] text-ink-600">
                      RC
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-ink-950">
                      {fmt(ratio, 2)}
                    </span>
                  </div>
                }
              />

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  label="Refrigerante requerido"
                  value={requiredRefrigerantId}
                  onChange={(value) =>
                    chooseRequiredRefrigerant(value as RefrigerantId)
                  }
                  tip="Refrigerante con el que debe operar el sistema. Si difiere del de diseño, el motor recalcula propiedades, densidad de succión, ηv, caudal y capacidad."
                >
                  {refrigerants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label="Condición requerida"
                  value={input.application}
                  onChange={(value) => {
                    setManualReferenceValues(false)
                    chooseApplication(value as CalculationInput['application'])
                  }}
                  tip="Régimen de operación necesario para el caso o aplicación requerida. Define las temperaturas objetivo del bloque requerido; la conversión de placa va siempre de diseño a requerida."
                >
                  <option value="LBP">LBP · baja temperatura</option>
                  <option value="MBP">MBP · media temperatura</option>
                  <option value="CBP">CBP · comercial media-alta</option>
                  <option value="HBP">HBP · alta temperatura</option>
                </SelectField>
              </div>

              {refrigerantChanged && (
                <div className="mt-3 space-y-2">
                  {(!Number.isFinite(input.displacement) ||
                    input.displacement <= 0) && (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[10px] font-medium leading-relaxed text-red-800"
                    >
                      <AlertTriangle
                        size={14}
                        className="mt-0.5 shrink-0 text-red-600"
                      />
                      Sin desplazamiento volumétrico no se puede recalcular con
                      precisión el cambio de densidad de succión ni la
                      eficiencia volumétrica de {requiredRefrigerantId}. Completa
                      el desplazamiento en el bloque de diseño.
                    </p>
                  )}
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-ember-500/25 bg-ember-500/10 px-3.5 py-2.5 text-[10px] font-medium leading-relaxed text-[#8a4a0b]"
                  >
                    <AlertTriangle
                      size={14}
                      className="mt-0.5 shrink-0 text-[#a55a10]"
                    />
                    Retrofit: verifica compatibilidad de aceite/lubricante
                    (mineral, POE o PAG), sellado y carga antes de operar con{' '}
                    {requiredRefrigerantId}. No reutilices la carga de{' '}
                    {input.refrigerantId} sin ajustar el circuito.
                  </p>
                </div>
              )}

              {refrigerantChanged && requiredRefrigerant.glideK >= 0.25 && (
                <p
                  role="status"
                  className="mt-2 text-[11px] font-medium text-amber-700"
                >
                  ⚠️ {requiredRefrigerantId} es una mezcla zeotrópica. Cargar
                  siempre en fase líquida.
                </p>
              )}

              {result && (
                <CapacityConversionBanner
                  normalization={result.capacityNormalization}
                  application={input.application}
                  unit={input.capacityUnit}
                  result={result}
                />
              )}

              {(input.targetEvapC <
                requiredRefrigerantLimits.minDesignEvapC ||
                input.targetCondC >
                  requiredRefrigerantLimits.maxDesignCondC) && (
                <p
                  role="alert"
                  className="mt-3 text-[11px] font-medium text-red-700"
                >
                  El punto requerido está fuera del rango termofísico de{' '}
                  {requiredRefrigerantId}. Ajusta la evaporación a ≥{' '}
                  {fmt(requiredRefrigerantLimits.minDesignEvapC, 0)} °C y la
                  condensación a ≤{' '}
                  {fmt(requiredRefrigerantLimits.maxDesignCondC, 0)} °C.
                </p>
              )}

              <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <NumberField
                  label="Evaporación objetivo"
                  value={input.targetEvapC}
                  onChange={(targetEvapC) =>
                    updateInput({
                      targetEvapC,
                      targetReturnGasTempC:
                        targetEvapC + input.targetSuperheatK,
                    })
                  }
                  unit="°C"
                  min={Math.max(-40, requiredRefrigerantLimits.minDesignEvapC)}
                  max={Math.min(15, requiredRefrigerantLimits.maxC)}
                  step={0.1}
                />
                <NumberField
                  label="Condensación objetivo"
                  value={input.targetCondC}
                  onChange={(targetCondC) => updateInput({ targetCondC })}
                  unit="°C"
                  min={25}
                  max={Math.min(65, requiredRefrigerantLimits.maxDesignCondC)}
                  step={0.1}
                />
                <NumberField
                  label="Temperatura de Retorno de gas"
                  value={input.targetReturnGasTempC}
                  onChange={(targetReturnGasTempC) =>
                    updateInput({
                      targetReturnGasTempC,
                      targetSuperheatK:
                        targetReturnGasTempC - input.targetEvapC,
                    })
                  }
                  unit="°C"
                  min={Math.max(-55, input.targetEvapC)}
                  max={100}
                  step={0.1}
                />
                <NumberField
                  label="Temperatura Ambiente"
                  value={input.targetAmbientTempC}
                  onChange={(targetAmbientTempC) =>
                    updateInput({ targetAmbientTempC })
                  }
                  unit="°C"
                  min={-20}
                  max={60}
                  step={0.1}
                />
                <NumberField
                  label="Recalentamiento (SH)"
                  value={input.targetSuperheatK}
                  onChange={(targetSuperheatK) =>
                    updateInput({
                      targetSuperheatK,
                      targetReturnGasTempC:
                        input.targetEvapC + targetSuperheatK,
                    })
                  }
                  unit="K"
                  min={0}
                  max={200}
                  step={0.1}
                />
                <NumberField
                  label="Subenfriamiento (SC)"
                  value={input.targetSubcoolK}
                  onChange={(targetSubcoolK) =>
                    updateInput({
                      targetSubcoolK: Math.min(
                        inputLimits.targetSubcoolK.max,
                        Math.max(inputLimits.targetSubcoolK.min, targetSubcoolK),
                      ),
                    })
                  }
                  unit="K"
                  min={inputLimits.targetSubcoolK.min}
                  max={inputLimits.targetSubcoolK.max}
                  step={0.1}
                  hint={`Entre ${inputLimits.targetSubcoolK.min} y ${inputLimits.targetSubcoolK.max} K.`}
                />
              </div>
              <div className="mt-4 rounded-xl border border-ink-900/[0.06] bg-frost-50/70 px-3.5 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-semibold text-ink-900">
                      Intercambiador Capilar/Succión (SLHX)
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-ink-600">
                      Ajusta el intercambio térmico entre el capilar y la succión.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={input.slhxActivo}
                    aria-label="Intercambiador Capilar/Succión (SLHX)"
                    onClick={() => updateInput({ slhxActivo: !input.slhxActivo })}
                    className={clsx(
                      'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2',
                      input.slhxActivo ? 'bg-mint-500' : 'bg-ink-900/15',
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                        input.slhxActivo ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>
                {input.slhxActivo && (
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <label
                          htmlFor="slhx-winding-percentage"
                          className="field-label mb-0"
                        >
                          % de Intercambio
                        </label>
                        <output
                          htmlFor="slhx-winding-percentage"
                          className="font-mono text-[12px] font-semibold text-ink-900"
                        >
                          {input.slhxPorcentaje}%
                        </output>
                      </div>
                      <input
                        id="slhx-winding-percentage"
                        type="range"
                        aria-label="Porcentaje de capilar enrollado"
                        min={30}
                        max={70}
                        step={5}
                        value={input.slhxPorcentaje}
                        onChange={(event) =>
                          updateInput({
                            slhxPorcentaje: Number(event.target.value),
                          })
                        }
                        className="range-input w-full"
                      />
                      <p className="mt-1 text-[10px] text-ink-600">
                        Porcentaje de longitud del capilar enrollada en la succión.
                      </p>
                    </div>
                    <SelectField
                      label="Diámetro del tubo de succión"
                      value={input.slhxDiametroSuccion}
                      onChange={(value) => {
                        if (!isSlhxSuctionTubeDiameter(value)) {
                          throw new Error(
                            `Diámetro de succión SLHX no reconocido: ${value}`,
                          )
                        }
                        updateInput({
                          slhxDiametroSuccion: value,
                        })
                      }}
                    >
                      {slhxSuctionTubeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}
              </div>
              {input.targetCondC - input.targetAmbientTempC < 5 && (
                <p role="alert" className="mt-2 text-[11px] font-medium text-amber-700">
                  Salto térmico bajo entre ambiente y condensación. Verifica la
                  ventilación y el punto de condensación.
                </p>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3 pb-2">
            <button type="button" onClick={resetPlate} className="btn-secondary">
              <RefreshCw size={14} />
              Restaurar placa
            </button>
          </div>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          {result ? (
            <>
              <ResultCard
                result={result}
                onShowDetails={() => setShowDetails(true)}
                diameterUnit={diameterUnit}
                lengthUnit={lengthUnit}
                slhxActivo={input.slhxActivo}
                onSlhxToggle={() =>
                  updateInput({ slhxActivo: !input.slhxActivo })
                }
                onDiameterUnitChange={setDiameterUnit}
                onLengthUnitChange={setLengthUnit}
              />
              {input.slhxActivo && result.slhx && (
                <div
                  role="group"
                  aria-label="Resultados del SLHX"
                  className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-ink-900/[0.08] bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-600">
                      Longitud enrollada
                    </p>
                    <p className="mt-1 font-mono text-[14px] font-semibold text-ink-950">
                      {fmt(result.slhx.lengthWoundM, 2)} m
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-600">
                      Efectividad real
                    </p>
                    <p className="mt-1 font-mono text-[14px] font-semibold text-ink-950">
                      {fmt(result.slhx.epsilonReal, 2)}
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4">
                <WarningList warnings={result.warnings} />
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-ink-900/[0.06] bg-white/60 px-3 py-2.5 text-[9px] leading-relaxed text-ink-600">
                <ShieldCheck size={12} className="mt-0.5 shrink-0 text-mint-700" />
                Estimación de ingeniería. La longitud final debe verificarse en
                banco o campo antes de una producción en serie.
              </div>
            </>
          ) : (
            <div className="panel p-6">
              <CircleAlert size={24} className="text-red-500" />
              <p className="mt-3 font-display text-[17px] font-semibold">
                Cálculo incompleto
              </p>
              <p className="mt-1 text-[11px] text-ink-600">
                Corrige los datos para volver a calcular el capilar.
              </p>
            </div>
          )}
        </aside>
      </div>

      {result && (
        <BreakdownModal
          open={showDetails}
          onClose={() => setShowDetails(false)}
          result={result}
          diameterUnit={diameterUnit}
          lengthUnit={lengthUnit}
        />
      )}

    </div>
  )
}
