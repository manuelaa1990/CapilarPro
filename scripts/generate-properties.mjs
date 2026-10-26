/**
 * Genera las tablas termofísicas versionadas que usa el motor en el navegador.
 *
 * Fuente: CoolProp 6.6.0 (HEOS). El resultado es un JSON estable, reproducible
 * y mucho más ligero que cargar el WASM completo en cada visita. El motor
 * interpola estas tablas; CoolProp sigue siendo la fuente de verdad.
 *
 * Uso: npm run data:properties
 */
import { writeFile } from 'node:fs/promises'
import { PropsSI } from 'coolprop-wasm/simple'

const FLUIDS = {
  R134a: { minC: -70, criticalC: 101.06 },
  R600a: { minC: -70, criticalC: 134.66 },
  R404A: { minC: -70, criticalC: 72.14 },
  R290: { minC: -70, criticalC: 96.74 },
  R22: { minC: -70, criticalC: 96.15 },
  R507A: { minC: -70, criticalC: 70.62 },
  R407C: { minC: -70, criticalC: 86.74, maxC: 68 },
  R417A: {
    minC: -70,
    criticalC: 87.2,
    maxC: 68,
    components: { R125: 0.466, R134a: 0.5, R600: 0.034 },
  },
  R422D: {
    minC: -70,
    criticalC: 79.7,
    maxC: 68,
    components: { R125: 0.651, R134a: 0.315, R600a: 0.034 },
  },
  R427A: {
    minC: -40,
    criticalC: 86.5,
    maxC: 68,
    components: { R32: 0.15, R125: 0.25, R143a: 0.1, R134a: 0.5 },
  },
}

const STEP = 1
const OUTPUT = new URL('../src/data/refrigerantTables.json', import.meta.url)

const props = {
  pBubble: async (T, f) => PropsSI('P', 'T', T, 'Q', 0, f),
  pDew: async (T, f) => PropsSI('P', 'T', T, 'Q', 1, f),
  rhoL: async (T, f) => PropsSI('D', 'T', T, 'Q', 0, f),
  rhoV: async (T, f) => PropsSI('D', 'T', T, 'Q', 1, f),
  hL: async (T, f) => PropsSI('H', 'T', T, 'Q', 0, f),
  hV: async (T, f) => PropsSI('H', 'T', T, 'Q', 1, f),
  cpL: async (T, f) => PropsSI('C', 'T', T, 'Q', 0, f),
  cpV: async (T, f) => PropsSI('C', 'T', T, 'Q', 1, f),
  muL: async (T, f) => PropsSI('V', 'T', T, 'Q', 0, f),
  muV: async (T, f) => PropsSI('V', 'T', T, 'Q', 1, f),
  kL: async (T, f) => PropsSI('L', 'T', T, 'Q', 0, f),
  kV: async (T, f) => PropsSI('L', 'T', T, 'Q', 1, f),
  sigma: async (T, f) => PropsSI('I', 'T', T, 'Q', 0, f),
}

const componentMolarMasses = new Map()

const fluidForBlend = async (components) => {
  if (!components) return null
  const fluids = Object.keys(components)
  const massFractions = Object.values(components)
  const molarMasses = await Promise.all(
    fluids.map(async (fluid) => {
      if (!componentMolarMasses.has(fluid)) {
        componentMolarMasses.set(
          fluid,
          await PropsSI('M', '', 0, '', 0, fluid),
        )
      }
      return componentMolarMasses.get(fluid)
    }),
  )
  const moleAmounts = massFractions.map(
    (fraction, index) => fraction / molarMasses[index],
  )
  const totalMoles = moleAmounts.reduce((sum, amount) => sum + amount, 0)
  const moleFractions = moleAmounts.map((amount) => amount / totalMoles)
  return {
    name: `HEOS::${fluids.map((name, index) => `${name}[${moleFractions[index]}]`).join('&')}`,
    molarMass: 1 / totalMoles,
  }
}

const round = (value, digits) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const fluids = {}

for (const [fluid, range] of Object.entries(FLUIDS)) {
  const rows = []
  const maxC =
    Math.floor(
      Math.min(range.maxC ?? range.criticalC - 1.5, range.criticalC - 1.5) /
        STEP,
    ) * STEP
  const mixture = await fluidForBlend(range.components)
  for (let t = range.minC; t <= maxC; t += STEP) {
    const T = t + 273.15
    try {
      let row
      if (mixture) {
        const readBlendProperty = (property, quality) =>
          PropsSI(property, 'T', T, 'Q', quality, mixture.name)
        const pBubble = await readBlendProperty('P', 0)
        const pDew = await readBlendProperty('P', 1)
        const rhoL = await readBlendProperty('D', 0)
        const rhoV = await readBlendProperty('D', 1)
        const hL = await readBlendProperty('H', 0)
        const hV = await readBlendProperty('H', 1)
        const cpL = await readBlendProperty('C', 0)
        const cpV = await readBlendProperty('C', 1)
        const muL = await readBlendProperty('V', 0)
        const muV = await readBlendProperty('V', 1)
        const kL = await readBlendProperty('L', 0)
        const kV = await readBlendProperty('L', 1)
        row = [
          round(t, 2),
          round(pBubble / 1000, 3),
          round(pDew / 1000, 3),
          round(rhoL, 3),
          round(rhoV, 5),
          round(hL, 1),
          round(hV, 1),
          round(cpL, 2),
          round(cpV, 2),
          round(muL, 8),
          round(muV, 8),
          Number.isFinite(kL) ? round(kL, 4) : null,
          Number.isFinite(kV) ? round(kV, 4) : null,
          null,
        ]
      } else {
        const values = Object.fromEntries(
          await Promise.all(
            Object.entries(props).map(async ([key, fn]) => [
              key,
              await fn(T, fluid),
            ]),
          ),
        )
        row = [
          round(t, 2),
          round(values.pBubble / 1000, 3),
          round(values.pDew / 1000, 3),
          round(values.rhoL, 3),
          round(values.rhoV, 5),
          round(values.hL, 1),
          round(values.hV, 1),
          round(values.cpL, 2),
          round(values.cpV, 2),
          round(values.muL, 8),
          round(values.muV, 8),
          round(values.kL, 4),
          round(values.kV, 4),
          round(values.sigma, 6),
        ]
      }
      if (
        row.some(
          (value, index) =>
            !Number.isFinite(value) &&
            !([11, 12, 13].includes(index) && value === null),
        )
      ) {
        throw new Error('valor no finito')
      }
      rows.push(row)
    } catch (error) {
      console.warn(`[${fluid}] ${t} °C omitido: ${error.message}`)
    }
  }

  if (rows.length < 20) {
    throw new Error(`Tabla insuficiente para ${fluid}`)
  }

  fluids[fluid] = {
    minC: rows[0][0],
    maxC: rows.at(-1)[0],
    criticalC: range.criticalC,
    molarMass: round(
      (mixture
        ? mixture.molarMass
        : await PropsSI('M', '', 0, '', 0, fluid)) * 1000,
      4,
    ),
    tripleC: mixture
      ? null
      : round((await PropsSI('Ttriple', '', 0, '', 0, fluid)) - 273.15, 3),
    rows,
  }
  console.log(
    `${fluid}: ${rows.length} filas · ${rows[0][0]}…${rows.at(-1)[0]} °C`,
  )
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'CoolProp 6.6.0 · HEOS; refrigerant blend compositions',
  stepK: STEP,
  columns: [
    'T_C',
    'pBubble_kPa',
    'pDew_kPa',
    'rhoL_kgm3',
    'rhoV_kgm3',
    'hL_Jkg',
    'hV_Jkg',
    'cpL_JkgK',
    'cpV_JkgK',
    'muL_Pas',
    'muV_Pas',
    'kL_WmK',
    'kV_WmK',
    'sigma_Nm',
  ],
  fluids,
}

await writeFile(OUTPUT, `${JSON.stringify(payload)}\n`, 'utf8')
console.log(`Escrito ${OUTPUT.pathname}`)
