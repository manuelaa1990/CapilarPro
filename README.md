# CapilarPro

Dimensionado de tubos capilares para refrigeración por compresión, anclado a los datos reales de la placa del compresor, con física trazable, incertidumbre declarada y aprendizaje local. El cálculo se ejecuta en el navegador; la sincronización con Neon es opcional.

![CapilarPro](docs/screenshot.png)

## Qué resuelve

La mayoría de las hojas de cálculo parten de una capacidad nominal genérica y aplican una tabla fija de eficiencia volumétrica. CapilarPro hace lo contrario:

1. Toma desplazamiento, frecuencia de red (50/60 Hz) y capacidad **en el punto de referencia de la placa**; para el compresor estándar de 2 polos calcula RPM = Hz × 60.
2. Despeja la eficiencia volumétrica real de ese compresor.
3. Extrapola la eficiencia al punto de diseño mediante el volumen nocivo.
4. Resuelve el capilar con un modelo 1D adiabático sobre la curva de saturación.
5. Declara la incertidumbre y aprende de las longitudes realmente instaladas.

El resultado es una recomendación de diámetro interior comercial × longitud, con alternativas y una banda de confianza, no un número aislado.

## Funciones principales

- **Anclaje a placa**: capacidad en W o BTU/h, desplazamiento en cm³/rev o in³/rev, frecuencia de red (50/60 Hz) y condiciones de referencia editables. El motor normaliza las unidades antes del cálculo.
- **Condiciones por aplicación**: perfiles LBP, MBP y HBP ajustan evap. y cond. según ASHRAE, EN 12900 o GB/T. El recalentamiento de ensayo se deriva de temperatura de retorno menos evaporación y el subenfriamiento de condensación menos ambiente; ambos son de solo lectura salvo que el usuario habilite la edición manual.
- **Punto de diseño**: evaporación y condensación objetivo con deslizadores e introducción exacta, temperatura de retorno y ambiente; el motor deriva el SH operativo y avisa si el salto térmico del condensador es bajo.
- **Unidades de salida**: el diámetro puede visualizarse en mm o pulgadas y la longitud en m, cm o pulgadas, también en el desglose técnico.
- **Extrapolación física**: eficiencia volumétrica con volumen nocivo efectivo derivado del punto medido.
- **Modelo de capilar**: integración 1D, calidad local por balance de energía, fricción de Darcy, viscosidad homogénea y multiplicador bifásico.
- **Incertidumbre honesta**: propagación RSS de modelo, capacidad, tolerancia dimensional, evidencia y propiedades.
- **Aprendizaje local**: mediana robusta de residuos logarítmicos con contracción bayesiana y sugerencias por similitud.
- **Historial y evidencias**: longitud instalada, evaporación medida, capacidad real y notas.
- **Datos portables**: exportación/importación JSON y almacenamiento en `localStorage`.
- **Sincronización opcional con Neon**: guarda compresores y soluciones en segundo plano; ante fallos de red conserva el cálculo en el historial local. Antes de publicar, aplica las migraciones SQL de `migrations/` en Neon.
- **Interfaz en español**, responsive y con panel de resultados fijo en escritorio.

## Refrigerantes y normas

| Refrigerantes | Normas de referencia |
| --- | --- |
| R134a, R600a, R404A, R290, R22, R507A, R407C, R417A, R422D, R427A | AHRI 540, EN 12900, AHRI histórico / ARI y condición personalizada |

Las propiedades de saturación se generan desde **CoolProp 6.6.0 (HEOS)** y se versionan en `src/data/refrigerantTables.json` con paso de 1 K. R407C usa su fluido HEOS; R417A, R422D y R427A usan sus composiciones másicas nominales como mezclas HEOS de componentes. La tabla de R427A comienza en −40 °C, límite de transporte disponible en esta versión. El motor usa la curva de rocío para la aspiración y la de burbuja para la condensación y el líquido subenfriado. El aviso de la interfaz recuerda cargar mezclas zeotrópicas en fase líquida. R438A no se ofrece todavía: HEOS 6.6 no tiene los parámetros de interacción necesarios para generar una tabla completa validada. El motor interpola las tablas en el navegador; no carga WASM en tiempo de ejecución.

## Cómo calcula

### 1. Eficiencia volumétrica anclada

Con el caudal barrido y las propiedades de aspiración/líquido en la referencia:

```text
RPM   = frecuencia [Hz] · 60 (compresor de 2 polos)
V̇    = Vd · RPM / 60
ηv,ref = Q0,ref / [V̇ · ρs · (hs − hl)]
```

Después se despeja el volumen nocivo efectivo `c` del modelo:

```text
ηv = 1 − λ − c · [(Pd/Ps)^(1/n) − 1]
```

Así la extrapolación conserva la eficiencia real del compresor en la placa y solo escala por relación de presiones. No se usa una tabla genérica de ηv. Si la capacidad de placa implica una eficiencia fuera del rango físico, la app la limita y **avisa** en lugar de ocultarlo.

### 2. Capilar 1D adiabático

Para cada diámetro comercial se integra la caída de presión a lo largo del tubo:

- balance de energía de estancamiento para la calidad local;
- densidad de mezcla homogénea;
- viscosidad dinámica ponderada por masa;
- factor de fricción de Darcy (laminar/turbulento);
- pérdida de entrada y multiplicador bifásico documentado.

La longitud que agota la presión objetivo es la predicción. El motor compara los diámetros comerciales, descarta longitudes fuera de la ventana práctica y ordena las alternativas.

### 3. Incertidumbre

Las contribuciones se combinan en cuadratura (RSS):

```text
σ_total = sqrt(σ_modelo² + σ_capacidad² + σ_diámetro² + σ_evidencia² + σ_propiedades² + …)
```

La incertidumbre del modelo domina la estimación. La evidencia de campo solo reduce el término empírico; nunca convierte una predicción en una certeza.

### 4. Aprendizaje local

Solo los casos con longitud real y diámetro real entran en la calibración.

```text
r = ln(L_real / L_modelo)
factor = exp(mediana_ponderada(r) · n / (n + 3))
```

La mediana ponderada por recencia evita que un caso atípico arrastre el modelo. La contracción exige más evidencia para corregir más. El factor se declara en el resultado y puede desactivarse en Ajustes.

## Stack

- React 18 + TypeScript
- Vite 6
- TailwindCSS
- Zod
- `@neondatabase/neon-js` para sincronización opcional
- Vitest + Testing Library
- `localStorage` + exportación/importación JSON
- Datos generados con CoolProp 6.6.0 HEOS

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

### Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Type-check + build de producción |
| `npm run preview` | Previsualiza el build |
| `npm run lint` | ESLint |
| `npm test` | Tests del motor, datos, almacenamiento y UI |
| `npm run data:validate` | Valida catálogos y tablas termofísicas |
| `npm run data:properties` | Regenera las tablas desde CoolProp |

### Tests

```bash
npm test
npm run data:validate
npm run lint
npm run build
```

Los tests cubren propiedades, anclaje de ηv, modelo de capilar, incertidumbre, fingerprint, calibración, esquemas Zod y flujos de la interfaz.

## Estructura

```text
src/
  components/     UI, layout, tarjetas, modales y tests de integración
  data/           Catálogos JSON y tablas termofísicas versionadas
  engine/         Propiedades, capilar, ηv, incertidumbre, normas, fingerprint
  lib/            Formateo y utilidades
  pages/          Calculadora, Historial, Modelo y Ajustes
  store/          Estado, persistencia, esquemas y aprendizaje
  types/          Contratos TypeScript
  App.tsx         Router por hash y límites de error
  main.tsx        Punto de entrada
scripts/
  generate-properties.mjs   Genera tablas CoolProp
  validate-data.mjs         Validación de datos para CI
```

La navegación usa hash routing (`#/`, `#/history`, `#/model`, `#/settings`) para funcionar en cualquier hosting estático, incluido GitHub Pages bajo subruta.

## Despliegue

El workflow `.github/workflows/ci.yml` valida datos, ejecuta tests, lint y build, y publica `dist/` en GitHub Pages cuando se hace push a `main`.

1. Sube el repositorio a GitHub.
2. En **Settings → Pages**, selecciona **GitHub Actions** como origen.
3. Haz push a `main`.

El `base: './'` de Vite permite servir la app desde la raíz o desde una subruta sin configuración adicional.

## Privacidad y persistencia

- Todo el cálculo ocurre en el navegador.
- Si Neon está configurado, las especificaciones del compresor y las condiciones/resultados de diseño se envían a Neon Data API; el motor no depende de esa conexión.
- El historial y los ajustes se guardan en `localStorage`. Si falla la sincronización, el cálculo se incorpora al historial local.
- Un `owner_id` aleatorio se conserva en `localStorage` y se adjunta a las soluciones. Es un identificador del navegador, no una identidad autenticada; las políticas RLS deben permitir el acceso anónimo requerido y no tratar ese valor enviado por el cliente como prueba de autorización.
- El usuario puede exportar un respaldo JSON, importarlo en otro equipo o borrar todo desde Ajustes.
- No se envían datos a servicios de analítica. La sincronización remota usa Neon cuando está habilitada y configurada.

## Límites de ingeniería

CapilarPro es una **herramienta de estimación**. No es CFD, no modela metaestabilidad, aceite, curvas de retorno, fugas, intercambiadores ni la instalación completa. La longitud final debe verificarse en banco o campo antes de una producción en serie.

La biblioteca de compresores incluida es ilustrativa y debe contrastarse siempre con la placa o el catálogo del fabricante. Las tablas de propiedades son una interpolación de CoolProp; para condiciones críticas o mezclas con glide pronunciado, verifica con la fuente original.

## Licencia

MIT. Consulta [LICENSE](LICENSE).
