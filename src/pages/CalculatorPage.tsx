import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Cloud,
  CloudOff,
  Database,
  Gauge,
  Info,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Thermometer,
} from 'lucide-react'
import clsx from 'clsx'
import type {
  CalculationInput,
  CalculationWarning,
  CapacityUnit,
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
import { Badge, Card, NumberField, SectionHeading, SelectField } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { ResultCard } from '../components/ResultCard'
import { LearningCard } from '../components/LearningCard'
import { BreakdownModal } from '../components/BreakdownModal'
import { CompressorSearch } from '../components/CompressorSearch'
import { saveCalculation } from '../lib/saveCalculation'
import { deriveReferenceSuperheatAndSubcooling } from '../engine/standards'
import { useNeonStatus } from '../store/neonStatusContext'

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

export const CalculatorPage = () => {
  const {
    input,
    result,
    calculationError,
    learned,
    settings,
    currentSaved,
    cases,
    chooseCompressor,
    chooseRefrigerant,
    chooseStandard,
    chooseApplication,
    updateInput,
    saveCurrentCase,
    navigate,
    dismissError,
  } = useApp()
  const [showDetails, setShowDetails] = useState(false)
  const [advanced, setAdvanced] = useState(settings.showAdvanced)
  const [manualReferenceValues, setManualReferenceValues] = useState(false)
  const [diameterUnit, setDiameterUnit] = useState<DiameterDisplayUnit>('mm')
  const [lengthUnit, setLengthUnit] = useState<LengthDisplayUnit>('m')
  const [toast, setToast] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)
  const autoSavedFingerprints = useRef(new Set<string>())
  const { setStatus: setNeonStatus } = useNeonStatus()

  useEffect(() => {
    if (!result || autoSavedFingerprints.current.has(result.fingerprint)) return

    autoSavedFingerprints.current.add(result.fingerprint)
    void saveCalculation(result).then((savedRemotely) => {
      if (savedRemotely) {
        setNeonStatus('connected')
        return
      }
      setNeonStatus('local')
      setToastIsError(true)
      setToast('Guardado localmente. No se pudo sincronizar con Neon.')
      window.setTimeout(() => setToast(null), 4200)
    }).catch((error: unknown) => {
      setNeonStatus('local')
      console.error('No se pudo guardar el cálculo ni en Neon ni localmente.', error)
      setToastIsError(true)
      setToast('No se pudo guardar el cálculo localmente.')
      window.setTimeout(() => setToast(null), 4200)
    })
  }, [result, setNeonStatus])

  const compressor = compressors.find((item) => item.id === input.compressorId)
  const standard = standards.find((item) => item.id === input.standardId) ?? standards[0]
  const refrigerant = refrigerantById(input.refrigerantId)
  const refrigerantLimits = fluidLimits(input.refrigerantId)
  const targetPressure = useMemo(
    () => pressureAt(input.refrigerantId, input.targetEvapC, 'dew'),
    [input.refrigerantId, input.targetEvapC],
  )
  const condPressure = useMemo(
    () => pressureAt(input.refrigerantId, input.targetCondC, 'bubble'),
    [input.refrigerantId, input.targetCondC],
  )
  const ratio =
    targetPressure > 0 ? condPressure / targetPressure : result?.compressor.targetPressureRatio ?? 0

  const save = () => {
    saveCurrentCase()
    setToastIsError(false)
    setToast('Caso guardado. La memoria local se actualizará si registras la longitud real.')
    window.setTimeout(() => setToast(null), 4200)
  }

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
        <Badge>
          <Cloud size={11} />
          Neon opcional
        </Badge>
        <span className="ml-auto hidden items-center gap-1.5 text-[10px] text-ink-600 md:flex">
          <span className="h-1 w-1 rounded-full bg-frost-300" />
          {cases.length} cálculos en memoria
        </span>
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
                eyebrow="Punto de partida"
                title="Datos del compresor y placa"
                description="Elige el equipo y el refrigerante, y completa los datos de placa. La biblioteca rellena valores que puedes editar."
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

                <SelectField
                    label="Aplicación"
                    value={input.application}
                  onChange={(value) => {
                    setManualReferenceValues(false)
                    chooseApplication(value as CalculationInput['application'])
                  }}
                    hint="Define el rango: baja, media o alta temperatura."
                >
                    <option value="LBP">LBP · baja temperatura</option>
                    <option value="MBP">MBP · media temperatura</option>
                    <option value="HBP">HBP · alta temperatura</option>
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

              <div className="mt-5">
                <SelectField
                  label="Refrigerante"
                  value={input.refrigerantId}
                  onChange={(value) => chooseRefrigerant(value as RefrigerantId)}
                >
                  {refrigerants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </SelectField>
                {refrigerant.glideK >= 0.25 && (
                  <p
                    role="status"
                    className="mt-2 text-[11px] font-medium text-amber-700"
                  >
                    ⚠️ Mezcla zeotrópica. Cargar siempre en fase líquida.
                  </p>
                )}
                {(input.targetEvapC < refrigerantLimits.minDesignEvapC ||
                  input.targetCondC > refrigerantLimits.maxDesignCondC) && (
                  <p
                    role="alert"
                    className="mt-2 text-[11px] font-medium text-red-700"
                  >
                    El punto de diseño está fuera del rango termofísico de{' '}
                    {input.refrigerantId}. Ajusta la evaporación a ≥{' '}
                    {fmt(refrigerantLimits.minDesignEvapC, 0)} °C y la
                    condensación a ≤ {fmt(refrigerantLimits.maxDesignCondC, 0)} °C.
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

              <div className="mt-4 rounded-2xl border border-ink-900/[0.06] bg-frost-50/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-700">
                    <Thermometer size={12} />
                    Estándar de ensayo
                    </div>
                    <p className="mt-1 text-[10px] text-ink-600">
                      Los valores se asignan según el estándar y la aplicación seleccionados.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[9px] text-ink-600">
                    {standard.shortName} · {fmt(input.refEvapC, 1)} / {fmt(input.refCondC, 1)} °C
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
                    min={Math.max(-65, refrigerantLimits.minC)}
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
                    max={Math.min(67, refrigerantLimits.maxC)}
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
                eyebrow="Punto de diseño"
                title="Condiciones de operación"
                description="El capilar se dimensiona para el caudal real que el compresor puede entregar en este punto, no para la capacidad de etiqueta."
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
                  min={Math.max(-40, refrigerantLimits.minDesignEvapC)}
                  max={Math.min(15, refrigerantLimits.maxC)}
                  step={0.1}
                />
                <NumberField
                  label="Condensación objetivo"
                  value={input.targetCondC}
                  onChange={(targetCondC) => updateInput({ targetCondC })}
                  unit="°C"
                  min={25}
                  max={Math.min(65, refrigerantLimits.maxDesignCondC)}
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
                  onChange={(targetSubcoolK) => updateInput({ targetSubcoolK })}
                  unit="K"
                  min={0}
                  max={100}
                  step={0.1}
                />
              </div>
              {input.targetCondC - input.targetAmbientTempC < 5 && (
                <p role="alert" className="mt-2 text-[11px] font-medium text-amber-700">
                  Salto térmico bajo entre ambiente y condensación. Verifica la
                  ventilación y el punto de condensación.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <button
              type="button"
              onClick={() => setAdvanced((value) => !value)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
              aria-expanded={advanced}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-frost-100 text-ink-700">
                  <Layers3 size={14} />
                </span>
                <div>
                  <p className="text-[11px] font-bold text-ink-900">
                    Capilar instalado y notas
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-600">
                    Opcional · acelera el aprendizaje con tu longitud real
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={clsx(
                  'shrink-0 text-ink-600 transition-transform',
                  advanced && 'rotate-180',
                )}
              />
            </button>
            {advanced && (
              <div className="border-t border-ink-900/[0.06] px-5 pb-5 pt-4 sm:px-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Diámetro interior instalado"
                    value={input.installedDiameterMm ?? 0}
                    onChange={(value) =>
                      updateInput({
                        installedDiameterMm: value > 0 ? value : null,
                      })
                    }
                    unit="mm"
                    min={0}
                    max={3.5}
                    step={0.01}
                    hint="Si ya montaste un capilar, indícalo para comparar."
                  />
                  <NumberField
                    label="Longitud instalada"
                    value={input.installedLengthM ?? 0}
                    onChange={(value) =>
                      updateInput({
                        installedLengthM: value > 0 ? value : null,
                      })
                    }
                    unit="m"
                    min={0}
                    max={10}
                    step={0.01}
                    hint="La longitud real medida, no la que crees que tiene."
                  />
                </div>
                <div className="mt-4">
                  <label className="field-label" htmlFor="notes">
                    Notas del caso
                  </label>
                  <textarea
                    id="notes"
                    value={input.notes}
                    onChange={(event) => updateInput({ notes: event.target.value })}
                    rows={2}
                    placeholder="Equipo, aceite, diámetro de línea, observaciones de campo…"
                    className="w-full resize-none rounded-xl border border-ink-900/10 bg-white px-3.5 py-2.5 text-[13px] text-ink-950 outline-none transition-all placeholder:text-ink-600/40 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10"
                  />
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-ember-500/[0.07] px-3 py-2.5 text-[10px] leading-relaxed text-[#8a5a1f]">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  Un capilar medido no es una validación completa. Para entrenar
                  el modelo, registra también la longitud real desde el historial
                  y, si puedes, la evaporación observada.
                </div>
              </div>
            )}
          </Card>

          <div className="flex flex-wrap items-center gap-3 pb-2">
            <button type="button" onClick={save} className="btn-primary" disabled={!result}>
              <Sparkles size={15} />
              Guardar y aprender
            </button>
            <button type="button" onClick={resetPlate} className="btn-secondary">
              <RefreshCw size={14} />
              Restaurar placa
            </button>
            {currentSaved && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-mint-700">
                <Check size={13} />
                Este cálculo ya está en tu historial
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate('history')}
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-ink-600 hover:text-ink-950"
            >
              Ver historial
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          {result ? (
            <>
              <ResultCard
                result={result}
                currentSaved={Boolean(currentSaved)}
                onSave={save}
                onShowDetails={() => setShowDetails(true)}
                calibration={learned.calibration}
                diameterUnit={diameterUnit}
                lengthUnit={lengthUnit}
                slhxActivo={input.slhxActivo}
                slhxEfectividad={input.slhxEfectividad}
                onSlhxToggle={() =>
                  updateInput({ slhxActivo: !input.slhxActivo })
                }
                onSlhxEfectividadChange={(slhxEfectividad) =>
                  updateInput({
                    slhxEfectividad: Math.min(1, Math.max(0, slhxEfectividad)),
                  })
                }
                onDiameterUnitChange={setDiameterUnit}
                onLengthUnitChange={setLengthUnit}
              />
              <LearningCard
                learned={learned}
                calibration={learned.calibration}
                diameterUnit={diameterUnit}
                lengthUnit={lengthUnit}
              />
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

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink-950 px-4 py-2.5 text-[11px] font-semibold text-white shadow-float lg:bottom-8">
          {toastIsError ? (
            <CloudOff size={14} className="text-amber-300" />
          ) : (
            <Check size={14} className="text-mint-300" />
          )}
          {toast}
        </div>
      )}

      {!settings.learningEnabled && (
        <div className="mt-5 flex items-center gap-2 text-[10px] text-ink-600">
          <Info size={12} />
          Aprendizaje desactivado en ajustes: el cálculo no aplica correcciones
          empíricas.
        </div>
      )}
    </div>
  )
}
