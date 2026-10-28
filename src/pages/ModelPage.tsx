import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Atom,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileCheck2,
  Gauge,
  GitBranch,
  Info,
  LockKeyhole,
  Ruler,
  ShieldCheck,
  Sigma,
  Thermometer,
  Waves,
} from 'lucide-react'
import { appMeta, correlations, refrigerants, standards } from '../data/catalog'
import { fluidLimits } from '../engine/properties'
import { fmt, fmtKpa } from '../lib/format'
import { Badge, Card } from '../components/ui'
import { PageHeader } from '../components/PageHeader'

const Step = ({
  number,
  icon: Icon,
  title,
  text,
}: {
  number: string
  icon: typeof Gauge
  title: string
  text: string
}) => (
  <div className="relative rounded-2xl border border-ink-900/[0.07] bg-white p-4">
    <div className="flex items-center justify-between">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-950 text-mint-300">
        <Icon size={16} />
      </span>
      <span className="font-mono text-[10px] font-bold text-frost-300">{number}</span>
    </div>
    <h3 className="mt-3 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink-950">
      {title}
    </h3>
    <p className="mt-1 text-[10px] leading-relaxed text-ink-600">{text}</p>
  </div>
)

const Formula = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto rounded-xl border border-ink-900/[0.07] bg-frost-50 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-ink-800">
    {children}
  </div>
)

const ModelSection = ({
  number,
  eyebrow,
  title,
  children,
}: {
  number: string
  eyebrow: string
  title: string
  children: ReactNode
}) => (
  <Card className="p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <span className="section-number">{number}</span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1 font-display text-[21px] font-semibold tracking-[-0.03em] text-ink-950">
          {title}
        </h2>
      </div>
    </div>
    <div className="mt-5">{children}</div>
  </Card>
)

export const ModelPage = () => {
  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Documentación del motor"
        title={
          <>
            Física trazable,
            <br className="hidden sm:block" /> incertidumbre sin maquillaje.
          </>
        }
        description="CapilarPro no es una caja negra. Aquí están las ecuaciones, los datos, las decisiones de modelado y los límites que debes conocer antes de usar una recomendación en campo."
        action={
          <div className="flex flex-col items-end gap-2">
            <Badge tone="mint">
              <ShieldCheck size={11} />
              Modelo abierto
            </Badge>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-600">
              {appMeta.modelVersion} · datos {appMeta.dataUpdatedAt}
            </span>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Step
          number="01"
          icon={FileCheck2}
          title="Ancla en la placa"
          text="Capacidad, desplazamiento, frecuencia de red y punto de referencia se usan para despejar la ηv real del equipo."
        />
        <Step
          number="02"
          icon={Gauge}
          title="Extrapola el punto"
          text="El volumen nocivo efectivo escala la eficiencia con la relación de presiones de diseño."
        />
        <Step
          number="03"
          icon={Waves}
          title="Resuelve el capilar"
          text="Integra fricción y calidad bifásica sobre la curva de saturación para cada diámetro comercial."
        />
        <Step
          number="04"
          icon={BrainCircuit}
          title="Aprende en local"
          text="La mediana de residuos de tus casos validados corrige el sesgo de longitud, con contracción."
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ModelSection number="01" eyebrow="Compresor" title="Eficiencia volumétrica anclada">
          <p className="text-[12px] leading-relaxed text-ink-600">
            La mayoría de calculadoras aplican una ηv tabulada o un factor fijo.
            CapilarPro despeja el volumen nocivo efectivo del propio punto de
            catálogo. Si la placa es coherente, el modelo reproduce exactamente
            la capacidad declarada y solo entonces extrapola.
          </p>
          <div className="mt-4 space-y-2.5">
            <Formula>
              V̄ = desplazamiento [m³/rev] × (frecuencia [Hz] × 60) / 60
              <br />
              ηv,ref = Q<sub>placa</sub> / (V̄ · ρ<sub>asp,ref</sub> · Δh<sub>ref</sub>)
            </Formula>
            <Formula>
              ηv = 1 − λ − c · [(Pd/Ps)<sup>1/n</sup> − 1]
              <br />
              c = (1 − λ − ηv,ref) / [(Pd/Ps)<sub>ref</sub><sup>1/n</sup> − 1]
            </Formula>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-xl bg-frost-50 p-3">
              <span className="font-semibold text-ink-900">n</span>
              <span className="ml-2 font-mono text-ink-600">
                {correlations.compressor.clearanceExponent}
              </span>
              <p className="mt-1 text-ink-600">Exponente politrópico de volumen nocivo.</p>
            </div>
            <div className="rounded-xl bg-frost-50 p-3">
              <span className="font-semibold text-ink-900">λ</span>
              <span className="ml-2 font-mono text-ink-600">
                {fmt(correlations.compressor.residualLoss * 100, 1)} %
              </span>
              <p className="mt-1 text-ink-600">Pérdidas residuales asumidas.</p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-600">
            <Info size={11} className="mt-0.5 shrink-0" />
            Si ηv,ref cae fuera de un rango físico, se limita y se avisa. Una
            capacidad de placa incoherente con el desplazamiento no se oculta.
          </p>
        </ModelSection>

        <ModelSection number="02" eyebrow="Capilar" title="Modelo 1D adiabático">
          <p className="text-[12px] leading-relaxed text-ink-600">
            El capilar se integra sobre la curva de saturación. La calidad local
            sale del balance de energía de estancamiento, no de una calidad media
            impuesta. La fricción usa viscosidad homogénea y un multiplicador de
            deslizamiento bifásico.
          </p>
          <div className="mt-4 space-y-2.5">
            <Formula>
              h₀ = h<sub>f</sub> + x·h<sub>fg</sub> + G²[v<sub>f</sub> + x·v<sub>fg</sub>]² / 2
            </Formula>
            <Formula>
              dP/dz = − Φ² · f · G² · v / (2D)
              <br />
              f = 0,316 · Re<sup>−0,25</sup> · (Re &gt; 2300)
            </Formula>
            <Formula>
              μ<sub>tp</sub> = 1 / [x/μ<sub>v</sub> + (1−x)/μ<sub>l</sub>]
              <br />
              Φ² = 1 + {correlations.capillary.twoPhaseMultiplierCoefficient} · x · √(v<sub>v</sub>/v<sub>l</sub>)
            </Formula>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[9px]">
            <div className="rounded-lg bg-frost-50 p-2.5">
              <p className="font-bold text-ink-900">
                {correlations.capillary.pressureSteps}
              </p>
              <p className="mt-0.5 text-ink-600">pasos de presión</p>
            </div>
            <div className="rounded-lg bg-frost-50 p-2.5">
              <p className="font-bold text-ink-900">
                {fmt(correlations.capillary.designLengthM, 1)} m
              </p>
              <p className="mt-0.5 text-ink-600">longitud objetivo</p>
            </div>
            <div className="rounded-lg bg-frost-50 p-2.5">
              <p className="font-bold text-ink-900">D⁻⁴</p>
              <p className="mt-0.5 text-ink-600">sensibilidad aprox.</p>
            </div>
          </div>
        </ModelSection>
      </div>

      <div className="mt-5">
        <ModelSection number="03" eyebrow="Condiciones" title="Normas y puntos de referencia">
          <p className="text-[12px] leading-relaxed text-ink-600">
            La norma solo define el punto de partida del formulario. El ancla
            siempre es la placa. Si un fabricante declara su capacidad a otra
            condición, selecciona “Personalizada” y copia el punto exacto.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-ink-900/10">
                  {['Norma', 'Evap.', 'Cond.', 'Recalent.', 'Subenfri.'].map((title) => (
                    <th
                      key={title}
                      className="px-2 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-600"
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standards.map((standard) => (
                  <tr key={standard.id} className="border-b border-ink-900/[0.05] last:border-0">
                    <td className="px-2 py-2.5">
                      <p className="font-semibold text-ink-900">{standard.name}</p>
                      <p className="text-[9px] text-ink-600">{standard.reference}</p>
                    </td>
                    <td className="px-2 py-2.5 font-mono">{fmt(standard.evapC, 1)} °C</td>
                    <td className="px-2 py-2.5 font-mono">{fmt(standard.condC, 1)} °C</td>
                    <td className="px-2 py-2.5 font-mono">{fmt(standard.superheatK, 1)} K</td>
                    <td className="px-2 py-2.5 font-mono">{fmt(standard.subcoolK, 1)} K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModelSection>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <ModelSection number="04" eyebrow="Datos" title="Tablas CoolProp 6.6.0 HEOS">
          <p className="text-[12px] leading-relaxed text-ink-600">
            El motor no carga un WASM de 6 MB en cada visita. Las propiedades de
            saturación se generaron con CoolProp 6.6.0, se versionan en el
            repositorio y se interpolan linealmente a 1 K. La fuente sigue siendo
            CoolProp y el script es reproducible.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {refrigerants.map((refrigerant) => {
              const limits = fluidLimits(refrigerant.id)
              return (
                <div
                  key={refrigerant.id}
                  className="rounded-xl border border-ink-900/[0.07] bg-frost-50/70 p-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: refrigerant.color }}
                    />
                    <span className="font-mono text-[11px] font-bold">{refrigerant.id}</span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-ink-600">
                    {fmt(limits.minC, 0)}…{fmt(limits.maxC, 0)} °C
                  </p>
                  <p className="mt-0.5 text-[8px] text-ink-600">
                    Tc {fmt(limits.criticalC, 1)} °C · M{' '}
                    {fmt(limits.molarMass, 1)}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-ink-900/[0.06] bg-white px-3 py-2.5 text-[10px] leading-relaxed text-ink-600">
            <Database size={13} className="mt-0.5 shrink-0 text-mint-700" />
            <span>
              Las mezclas R-404A y R-507A se tratan promediando su pequeña glide
              de saturación. El resultado lo declara y la incertidumbre lo incluye
              en la práctica como limitación de modelo.
            </span>
          </div>
        </ModelSection>

        <ModelSection number="05" eyebrow="Incertidumbre" title="Lo que la barra significa">
          <p className="text-[12px] leading-relaxed text-ink-600">
            La barra no es una probabilidad inventada. Es una propagación RSS de
            fuentes relativas y se recalcula con cada caso. El modelo de capilar
            es la mayor contribución; la evidencia de campo solo reduce el término
            empírico.
          </p>
          <div className="mt-4 space-y-2">
            {[
              ['Modelo de capilar', `${fmt(correlations.uncertainty.capillaryModel * 100, 0)} %`],
              ['Capacidad de placa', `${fmt(correlations.uncertainty.nameplateCapacity * 100, 0)} %`],
              ['Tolerancia de diámetro', `${fmt(correlations.uncertainty.diameterTolerance * 4.1, 1)} %`],
              ['Evidencia base', `${fmt(correlations.uncertainty.calibrationBase * 100, 1)} %`],
              ['Propiedades / ΔT', `${fmt(correlations.uncertainty.properties * 100, 1)} %`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-ink-600">{label}</span>
                <span className="font-mono text-[10px] font-semibold text-ink-900">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-ink-900/[0.06] bg-frost-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-800">
              <Sigma size={12} className="text-mint-700" />
              RSS, no suma lineal
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-600">
              σ<sub>total</sub> = √(σ₁² + σ₂² + … + σₙ²). La banda de longitud se
              muestra en metros en el resultado y en el desglose.
            </p>
          </div>
        </ModelSection>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <ModelSection number="06" eyebrow="Aprendizaje" title="Memoria de taller con contracción">
          <p className="text-[12px] leading-relaxed text-ink-600">
            Solo los casos con longitud real y diámetro real entran en la
            calibración. El residuo se calcula en escala logarítmica, se toma la
            mediana ponderada por recencia y se contrae hacia 1 según el número de
            muestras.
          </p>
          <div className="mt-4 space-y-2.5">
            <Formula>
              r = ln(L<sub>real</sub> / L<sub>modelo</sub>)
              <br />
              k = exp[ median(r) · n / (n + {correlations.learning.shrinkagePrior}) ]
            </Formula>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-xl bg-frost-50 p-3">
              <p className="font-semibold text-ink-900">Mínimo para ajustar</p>
              <p className="mt-1 font-mono text-ink-600">
                {correlations.learning.minimumCalibrationSamples} casos reales
              </p>
            </div>
            <div className="rounded-xl bg-frost-50 p-3">
              <p className="font-semibold text-ink-900">Corrección máxima</p>
              <p className="mt-1 font-mono text-ink-600">
                ± {fmt(correlations.learning.maxAbsLogCorrection * 100, 0)} %
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-600">
            <LockKeyhole size={11} className="mt-0.5 shrink-0" />
            Todo el aprendizaje ocurre en localStorage. No hay cuentas ni
            telemetría. Solo hay red si activas la sincronización anónima.
          </p>
        </ModelSection>

        <ModelSection number="07" eyebrow="Límites" title="Lo que este modelo no es">
          <div className="space-y-2.5">
            {[
              [
                'No es CFD bifásico',
                'No resuelve la estructura de flujo, ondas de presión ni metaestabilidad subenfriada. Es un modelo 1D homogéneo con corrección de deslizamiento.',
              ],
              [
                'No conoce tu instalación',
                'Rebabas, curvaturas, aceite, filtros, línea líquida, intercambiador succión-líquido y posición del capilar pueden mover el resultado varios puntos porcentuales.',
              ],
              [
                'No certifica un producto',
                'La recomendación orienta el prototipo y la compra de tubo. La validación final debe hacerse en banco o campo, midiendo presiones y temperatura.',
              ],
              [
                'No es una tabla de capacidad',
                'El ancla es solo tan buena como la placa. Si el dato de catálogo es nominal o está a otra condición, el resultado lo reflejará.',
              ],
            ].map(([title, text]) => (
              <div
                key={title}
                className="flex items-start gap-2.5 rounded-xl border border-ember-500/15 bg-ember-500/[0.045] px-3 py-2.5"
              >
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#a15a13]" />
                <div>
                  <p className="text-[10px] font-bold text-ink-900">{title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-ink-600/75">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ModelSection>
      </div>

      <div className="mt-5 overflow-hidden rounded-[22px] bg-ink-950 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-mint-300">
              <GitBranch size={18} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mint-300">
                Reproducibilidad
              </p>
              <h2 className="mt-1 font-display text-[20px] font-semibold tracking-[-0.02em]">
                Todo dato y constante está versionado
              </h2>
              <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-white/60">
                El engine CP-HEM-1.0, las tablas termofísicas, las normas y las
                constantes de correlación forman una unidad reproducible. Si
                cambias un parámetro, la huella del caso y el modelo lo registran.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">
              <CheckCircle2 size={10} /> {appMeta.version}
            </Badge>
            <Badge tone="dark">
              <Atom size={10} /> HEOS
            </Badge>
            <Badge tone="dark">
              <Ruler size={10} /> SI
            </Badge>
          </div>
        </div>
        <div className="mt-5 grid gap-2 text-[10px] sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-white/60">
              <Thermometer size={11} /> Rango de presión
            </span>
            <p className="mt-1 font-mono text-white/70">
              {fmtKpa(2)} … {fmtKpa(7000)}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-white/60">
              <FileCheck2 size={11} /> Normas soportadas
            </span>
            <p className="mt-1 font-mono text-white/70">
              AHRI 540 · EN 12900 · legacy · custom
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-white/60">
              <BookOpen size={11} /> Lectura recomendada
            </span>
            <p className="mt-1 text-white/70">
              ASHRAE Handbook · Refrigeration
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[9px] text-ink-600">
        <ArrowRight size={10} />
        Si un resultado no cuadra con campo, guarda la evidencia y deja que el
        modelo local aprenda de tu instalación.
      </p>
    </div>
  )
}
