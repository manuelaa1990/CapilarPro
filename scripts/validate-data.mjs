/**
 * Validación estructural y termodinámica de los datos versionados.
 *
 * Uso: npm run data:validate
 * No sustituye a los tests del motor, pero evita publicar catálogos con
 * referencias rotas, filas no monotónicas o unidades incoherentes.
 */
import { readFile } from 'node:fs/promises'

const readJson = async (name) =>
  JSON.parse(
    await readFile(new URL(`../src/data/${name}`, import.meta.url), 'utf8'),
  )

const errors = []
const check = (condition, message) => {
  if (!condition) errors.push(message)
}

const standards = (await readJson('standards.json')).standards
const refrigerants = (await readJson('refrigerants.json')).refrigerants
const compressors = (await readJson('compressors.json')).compressors
const solutions = await readJson('solutions.json')
const defaults = await readJson('defaults.json')
const correlations = await readJson('correlations.json')
const tables = (await readJson('refrigerantTables.json')).fluids

const supported = [
  'R134a',
  'R600a',
  'R404A',
  'R290',
  'R22',
  'R507A',
  'R407C',
  'R417A',
  'R422D',
  'R427A',
]

check(
  standards.length >= 4,
  'Deben existir al menos cuatro condiciones de referencia',
)
const standardIds = new Set()
for (const standard of standards) {
  check(!standardIds.has(standard.id), `Norma duplicada: ${standard.id}`)
  standardIds.add(standard.id)
  check(
    Number.isFinite(standard.evapC) &&
      Number.isFinite(standard.condC) &&
      standard.condC > standard.evapC + 8,
    `Norma con salto térmico inválido: ${standard.id}`,
  )
}

check(
  refrigerants.length === supported.length,
  'La lista de refrigerantes no coincide con los soportados',
)
const refrigerantIds = new Set()
for (const refrigerant of refrigerants) {
  check(
    supported.includes(refrigerant.id),
    `Refrigerante no soportado: ${refrigerant.id}`,
  )
  check(
    !refrigerantIds.has(refrigerant.id),
    `Refrigerante duplicado: ${refrigerant.id}`,
  )
  refrigerantIds.add(refrigerant.id)
}

const compressorIds = new Set()
for (const compressor of compressors) {
  check(
    !compressorIds.has(compressor.id),
    `Compresor duplicado: ${compressor.id}`,
  )
  compressorIds.add(compressor.id)
  check(
    compressor.refrigerants.length > 0 &&
      compressor.refrigerants.every((id) => refrigerantIds.has(id)),
    `Compresor con refrigerantes inválidos: ${compressor.id}`,
  )
  check(
    compressor.displacementCm3Rev >= 0.2 &&
      compressor.displacementCm3Rev <= 3000,
    `Desplazamiento fuera de rango: ${compressor.id}`,
  )
  check(
    compressor.rpm >= 300 && compressor.rpm <= 9000,
    `RPM fuera de rango: ${compressor.id}`,
  )
  check(
    compressor.ratedCapacityW >= 20 &&
      compressor.ratedCapacityW <= 250000,
    `Capacidad fuera de rango: ${compressor.id}`,
  )
  check(
    compressor.ratedCondC > compressor.ratedEvapC + 8,
    `Punto de placa con salto inválido: ${compressor.id}`,
  )
  for (const refrigerant of compressor.refrigerants) {
    const table = tables[refrigerant]
    check(Boolean(table), `Falta tabla para ${refrigerant}`)
    if (table) {
      check(
        compressor.ratedEvapC >= table.minC &&
          compressor.ratedCondC <= table.maxC,
        `Punto de placa fuera de tabla: ${compressor.id} / ${refrigerant}`,
      )
    }
  }
}

check(
  solutions.capillaryIdsMm.length >= 8,
  'El catálogo de diámetros interiores es demasiado corto',
)
check(
  solutions.capillaryIdsMm.every(
    (diameter, index, list) =>
      diameter > 0 && (index === 0 || diameter > list[index - 1]),
  ),
  'Los diámetros capilares deben ser positivos y crecientes',
)

const defaultCompressor = compressors.find(
  (item) => item.id === defaults.defaults.compressorId,
)
check(Boolean(defaultCompressor), 'El compresor por defecto no existe')
check(
  defaults.defaults.refrigerantId === 'R134a' ||
    Boolean(defaultCompressor?.refrigerants.includes(defaults.defaults.refrigerantId)),
  'El refrigerante por defecto no es válido',
)
check(
  standardIds.has(defaults.defaults.standardId),
  'La norma por defecto no existe',
)
check(
  defaults.defaults.targetCondC > defaults.defaults.targetEvapC + 8,
  'El punto objetivo por defecto tiene un salto inválido',
)

check(
  correlations.capillary.pressureSteps >= 32,
  'La integración del capilar necesita más pasos de presión',
)
check(
  correlations.uncertainty.capillaryModel > 0 &&
    correlations.uncertainty.capillaryModel < 0.5,
  'La incertidumbre del modelo de capilar está fuera de rango',
)

const STEP = 1
for (const fluid of supported) {
  const table = tables[fluid]
  check(Boolean(table), `Falta la tabla de ${fluid}`)
  if (!table) continue
  check(table.rows.length >= 20, `Tabla demasiado corta: ${fluid}`)
  check(
    table.molarMass > 1 && table.molarMass < 300,
    `Masa molar fuera de rango: ${fluid}`,
  )
  let previousT = -Infinity
  let previousBubble = -Infinity
  let previousDew = -Infinity
  for (const [index, row] of table.rows.entries()) {
    check(row.length === 14, `Fila mal formada en ${fluid}[${index}]`)
    const [temperature, pBubble, pDew, rhoL, rhoV, hL, hV] = row
    check(
      temperature > previousT,
      `Temperatura no creciente en ${fluid}[${index}]`,
    )
    check(
      pBubble > previousBubble && pDew > previousDew,
      `Presión no monotónica en ${fluid}[${index}]`,
    )
    check(
      pBubble > 0 &&
        pDew > 0 &&
        Math.abs(pDew - pBubble) / Math.min(pBubble, pDew) < 0.7,
      `Glide de presión incoherente en ${fluid}[${index}]`,
    )
    check(
      rhoL > 0 && rhoV > 0 && hV > hL,
      `Propiedades incoherentes en ${fluid}[${index}]`,
    )
    check(
      index === 0 || Math.abs(temperature - previousT - STEP) < 1e-6,
      `Paso térmico distinto de 1 K en ${fluid}[${index}]`,
    )
    previousT = temperature
    previousBubble = pBubble
    previousDew = pDew
  }
  check(
    table.minC === table.rows[0][0] && table.maxC === table.rows.at(-1)[0],
    `Rango declarado incoherente en ${fluid}`,
  )
}

if (errors.length > 0) {
  console.error(`\n${errors.length} problema(s) de datos:\n`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(
  `Datos válidos: ${refrigerants.length} refrigerantes, ${compressors.length} compresores, ` +
    `${standards.length} normas y ` +
    `${supported.reduce((sum, fluid) => sum + tables[fluid].rows.length, 0)} filas termofísicas.`,
)
