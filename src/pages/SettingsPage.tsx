import { useRef, useState } from 'react'
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Database,
  Download,
  FileUp,
  FlaskConical,
  HardDrive,
  Info,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { appMeta, defaults } from '../data/catalog'
import { fmt } from '../lib/format'
import { useApp } from '../store/useApp'
import { Badge, Card, SectionHeading } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { Logo } from '../components/Logo'
import { Modal } from '../components/Modal'

const Toggle = ({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description: string
  icon: typeof BrainCircuit
}) => (
  <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-frost-100 text-ink-700">
        <Icon size={15} />
      </span>
      <div>
        <p className="text-[12px] font-semibold text-ink-900">{label}</p>
        <p className="mt-0.5 max-w-md text-[10px] leading-relaxed text-ink-600">
          {description}
        </p>
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-mint-500' : 'bg-ink-900/15',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  </div>
)

type ConfirmKind = 'cases' | 'reset' | null

export const SettingsPage = () => {
  const {
    settings,
    cases,
    learned,
    updateSettings,
    exportAll,
    importAll,
    loadDemoCases,
    clearCases,
    resetEverything,
    storageMode,
    navigate,
  } = useApp()
  const [name, setName] = useState(settings.appName)
  const [toast, setToast] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(null), 4000)
  }

  const saveName = () => {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setName(settings.appName)
      return
    }
    updateSettings({ appName: trimmed })
    showToast('Nombre actualizado.')
  }

  const dataSize = new Blob([JSON.stringify(cases)]).size
  const actualCount = cases.filter((item) => item.actual?.lengthM).length

  const runImport = async (file: File) => {
    try {
      const result = await importAll(file)
      showToast(
        `${result.received} caso(s) importados · ${result.duplicates} duplicado(s).`,
      )
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se pudo importar el respaldo.',
      )
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Configuración"
        title={
          <>
            Tu herramienta,
            <br className="hidden sm:block" /> tus datos, tus reglas.
          </>
        }
        description="Ajusta la identidad de la app, el comportamiento del aprendizaje y la gestión de la memoria local. Nada sale de este navegador."
        action={
          <Badge tone={storageMode === 'localStorage' ? 'mint' : 'amber'}>
            <HardDrive size={11} />
            {storageMode === 'localStorage' ? 'Persistencia local' : 'Solo memoria'}
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionHeading
              number="01"
              eyebrow="Identidad"
              title="Nombre de la aplicación"
              description="Se muestra en la barra lateral, el historial y el título de la pestaña."
            />
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-ink-900/[0.07] bg-frost-50 p-4">
              <Logo name={name || settings.appName} compact />
              <div className="ml-auto text-right text-[9px] leading-tight text-ink-600">
                Vista previa
                <br />
                <span className="font-mono">{appMeta.modelVersion}</span>
              </div>
            </div>
            <div className="mt-4">
              <label className="field-label" htmlFor="app-name">
                Nombre mostrado
              </label>
              <div className="flex gap-2">
                <input
                  id="app-name"
                  value={name}
                  maxLength={30}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={saveName}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                  className="w-full rounded-xl border border-ink-900/10 bg-white px-3.5 py-2.5 text-[14px] font-medium outline-none transition-all focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10"
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={saveName}
                >
                  <Check size={14} />
                  Guardar
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-ink-600">
                Entre 2 y 30 caracteres. El logo no cambia.
              </p>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeading
              number="02"
              eyebrow="Comportamiento"
              title="Aprendizaje y formulario"
              description="El motor siempre calcula con física. Estas opciones controlan qué evidencia se aplica y cómo se abre el formulario."
            />
            <div className="mt-4 divide-y divide-ink-900/[0.06]">
              <Toggle
                checked={settings.learningEnabled}
                onChange={(value) =>
                  updateSettings({ learningEnabled: value })
                }
                label="Aprendizaje local"
                description="Aplica la corrección robusta de longitud si hay al menos dos casos validados para el refrigerante o, en su defecto, a nivel global."
                icon={BrainCircuit}
              />
              <Toggle
                checked={settings.showAdvanced}
                onChange={(value) => updateSettings({ showAdvanced: value })}
                label="Abrir opciones avanzadas"
                description="Muestra por defecto el bloque de capilar instalado y notas del caso en la calculadora."
                icon={Sparkles}
              />
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200/60 bg-sky-50/60 px-3 py-2.5 text-[10px] leading-relaxed text-sky-800">
              <Info size={12} className="mt-0.5 shrink-0" />
              El cálculo en vivo está siempre activo. Desactivar el aprendizaje no
              cambia la física: el resultado deja de aplicar el factor empírico de
              tu historial.
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeading
              number="03"
              eyebrow="Datos"
              title="Copia de seguridad local"
              description="Un respaldo JSON contiene ajustes, cálculos y evidencias de campo. Puedes importarlo en otro navegador o equipo."
            />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-frost-50 p-3">
                <p className="font-display text-[20px] font-semibold leading-none">
                  {cases.length}
                </p>
                <p className="mt-1 text-[9px] text-ink-600">casos</p>
              </div>
              <div className="rounded-xl bg-frost-50 p-3">
                <p className="font-display text-[20px] font-semibold leading-none">
                  {actualCount}
                </p>
                <p className="mt-1 text-[9px] text-ink-600">validados</p>
              </div>
              <div className="rounded-xl bg-frost-50 p-3">
                <p className="font-display text-[20px] font-semibold leading-none">
                  {fmt(dataSize / 1024, 1)}
                </p>
                <p className="mt-1 text-[9px] text-ink-600">KB de historial</p>
              </div>
              <div className="rounded-xl bg-frost-50 p-3">
                <p className="font-display text-[20px] font-semibold leading-none">
                  {fmt(learned.calibration.factor, 3)}
                </p>
                <p className="mt-1 text-[9px] text-ink-600">factor actual</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={exportAll} className="btn-secondary">
                <Download size={14} />
                Exportar respaldo JSON
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-secondary"
              >
                <FileUp size={14} />
                Importar respaldo
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
              <button
                type="button"
                onClick={() => {
                  const count = loadDemoCases()
                  showToast(`${count} casos de demostración añadidos.`)
                }}
                className="btn-secondary"
              >
                <FlaskConical size={14} />
                Añadir casos demo
              </button>
              <button
                type="button"
                onClick={() => setConfirm('cases')}
                className="btn-secondary text-red-600 hover:border-red-200 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Vaciar historial
              </button>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-600">
              <Database size={11} className="mt-0.5 shrink-0" />
              Límite de {defaults.ui.maxCases} casos. Los más antiguos se
              descartan al superar el límite. La exportación no incluye las tablas
              termofísicas ni el código.
            </p>
          </Card>

          <div className="rounded-[22px] border border-red-200/80 bg-red-50/40 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <AlertTriangle size={15} />
              </span>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">
                  Zona de peligro
                </p>
                <h2 className="mt-1 font-display text-[19px] font-semibold tracking-[-0.02em] text-ink-950">
                  Restablecer CapilarPro
                </h2>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-600">
                  Borra todos los casos, evidencias, ajustes y la memoria
                  aprendida. No afecta a otros datos del navegador.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirm('reset')}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-3.5 py-2 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100"
                >
                  <RotateCcw size={13} />
                  Restablecer todo
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="relative overflow-hidden bg-ink-950 p-5 text-white">
              <div className="pointer-events-none absolute inset-0 bg-instrument-grid bg-[size:22px_22px] opacity-60" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-mint-300">
                  <LockKeyhole size={12} />
                  Privacidad por diseño
                </div>
                <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight tracking-[-0.03em]">
                  Nada de lo que calculas sale del navegador.
                </h2>
                <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                  Sin cuentas, sin backend, sin analítica. El historial se guarda
                  en localStorage y el respaldo lo decides tú.
                </p>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {[
                [ShieldCheck, 'Cero llamadas de red', 'El motor y los datos están incluidos en el build.'],
                [HardDrive, 'Persistencia local', `Modo actual: ${storageMode}.`],
                [Database, 'Datos versionados', `Tablas ${appMeta.propertySource}.`],
                [FileUp, 'Portabilidad', 'Exporta e importa todo el conocimiento del taller.'],
              ].map(([Icon, title, detail]) => {
                const IconComponent = Icon as typeof ShieldCheck
                return (
                  <div key={String(title)} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint-500/10 text-mint-700">
                      <IconComponent size={13} />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold text-ink-900">
                        {String(title)}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-ink-600">
                        {String(detail)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Info size={14} className="text-ink-600" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-ink-700">
                Acerca de
              </h2>
            </div>
            <dl className="mt-4 space-y-3 text-[10px]">
              {[
                ['Producto', appMeta.name],
                ['Versión', appMeta.version],
                ['Motor', appMeta.modelVersion],
                ['Propiedades', appMeta.propertySource],
                ['Normas', 'ASHRAE · EN 12900 · GB/T · legacy · custom'],
                ['Licencia', 'MIT'],
              ].map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <dt className="text-ink-600">{key}</dt>
                  <dd className="max-w-[65%] text-right font-medium text-ink-800">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-xl bg-frost-50 px-3 py-2.5 text-[9px] leading-relaxed text-ink-600">
              CapilarPro es una herramienta de estimación de ingeniería. No
              sustituye la validación experimental ni las instrucciones del
              fabricante.
            </div>
          </Card>

          <button
            type="button"
            onClick={() => navigate('model')}
            className="flex w-full items-center justify-between rounded-2xl border border-ink-900/[0.07] bg-white px-4 py-3.5 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div>
              <p className="text-[11px] font-bold text-ink-900">Leer el modelo</p>
              <p className="mt-0.5 text-[9px] text-ink-600">
                Ecuaciones, límites y trazabilidad
              </p>
            </div>
            <span className="text-mint-700">→</span>
          </button>
        </div>
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'reset' ? 'Restablecer todo' : 'Vaciar historial'}
        eyebrow="Confirmación"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              onClick={() => {
                if (confirm === 'reset') {
                  resetEverything()
                  setConfirm(null)
                  navigate('calculator')
                } else {
                  clearCases()
                  setConfirm(null)
                  showToast('Historial vaciado.')
                }
              }}
            >
              <Trash2 size={14} />
              {confirm === 'reset' ? 'Restablecer todo' : 'Vaciar historial'}
            </button>
          </>
        }
      >
        <p className="text-[12px] leading-relaxed text-ink-600">
          {confirm === 'reset'
            ? 'Se borrarán todos los casos, evidencias, ajustes y la memoria aprendida de este navegador. Esta acción no se puede deshacer.'
            : 'Se borrarán todos los casos y evidencias. El modelo dejará de tener memoria y volverá a su incertidumbre base. La configuración se mantiene.'}
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-800">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Exporta un respaldo antes de continuar si quieres conservar tus datos.
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-full bg-ink-950 px-4 py-2.5 text-[11px] font-semibold text-white shadow-float lg:bottom-8">
          {toast.includes('No ') || toast.includes('válido') ? (
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
