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

const round = (value, digits) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const fluids = {}

for (const [fluid, range] of Object.entries(FLUIDS)) {
  const rows = []
  const maxC = Math.floor((range.criticalC - 1.5) / STEP) * STEP
  for (let t = range.minC; t <= maxC; t += STEP) {
    const T = t + 273.15
    try {
      const values = Object.fromEntries(
        await Promise.all(
          Object.entries(props).map(async ([key, fn]) => [key, await fn(T, fluid)]),
        ),
      )
      const row = [
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
      if (row.some((value) => !Number.isFinite(value))) {
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
    molarMass: round((await PropsSI('M', '', 0, '', 0, fluid)) * 1000, 4),
    tripleC: round((await PropsSI('Ttriple', '', 0, '', 0, fluid)) - 273.15, 3),
    rows,
  }
  console.log(
    `${fluid}: ${rows.length} filas · ${rows[0][0]}…${rows.at(-1)[0]} °C`,
  )
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'CoolProp 6.6.0 · HEOS',
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
