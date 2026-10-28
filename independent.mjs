import Module from 'coolprop-wasm'

const CP = await Module()
const state = CP.factory('HEOS', 'R134a')

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

const satPQ = (P, Q) => {
  state.update(CP.input_pairs.PQ_INPUTS, P, Q)
  return {
    P,
    T: state.T(),
    rho: state.rhomass(),
    v: 1 / state.rhomass(),
    h: state.hmass(),
    cp: state.cpmass(),
    mu: state.viscosity(),
  }
}

const pt = (P, T) => {
  state.update(CP.input_pairs.PT_INPUTS, P, T)
  return {
    P,
    T,
    rho: state.rhomass(),
    v: 1 / state.rhomass(),
    h: state.hmass(),
    cp: state.cpmass(),
    mu: state.viscosity(),
  }
}

const satT = (T, Q) => {
  state.update(CP.input_pairs.QT_INPUTS, Q, T)
  return satPQ(state.p(), Q)
}

const qualityFromEnergy = (hL, hV, vL, vV, G2, h0) => {
  const hfg = hV - hL
  const vfg = vV - vL
  const a = 0.5 * G2 * vfg * vfg
  const b = hfg + G2 * vL * vfg
  const c = hL - h0 + 0.5 * G2 * vL * vL
  if (Math.abs(a) < 1e-12) return clamp(-c / Math.max(b, 1e-9), 0, 1)
  const disc = b * b - 4 * a * c
  if (disc < 0) return clamp((h0 - hL) / Math.max(hfg, 1), 0, 1)
  const r1 = (-b + Math.sqrt(disc)) / (2 * a)
  const r2 = (-b - Math.sqrt(disc)) / (2 * a)
  const candidates = [r1, r2].filter(
    (r) => Number.isFinite(r) && r >= -1e-4 && r <= 1.0001,
  )
  return candidates.length
    ? clamp(Math.min(...candidates), 0, 1)
    : clamp(Math.min(r1, r2), 0, 1)
}

const capillaryLength = ({
  D,
  P_in,
  P_out,
  m_dot,
  T_in,
  K = 0.5,
  steps = 600,
  phiModel = 'app',
  verbose = false,
}) => {
  const A = (Math.PI / 4) * D * D
  const G = m_dot / A
  const G2 = G * G
  const liquidIn = pt(P_in, T_in)
  const v_in = liquidIn.v
  const h_in = liquidIn.h
  const dP_inlet = (K * G2 * v_in) / 2
  const P0 = P_in - dP_inlet
  if (P0 <= P_out) return null
  const h0 = h_in + 0.5 * G2 * v_in * v_in
  let P = P0
  let L = 0
  let xOut = 0
  let choked = false
  let P_out_actual = P_out
  const dP = (P0 - P_out) / steps

  for (let i = 0; i < steps; i += 1) {
    const Pa = P
    const Pb = Math.max(P - dP, P_out)
    const Pmid = (Pa + Pb) / 2
    const f = satPQ(Pmid, 0)
    const g = satPQ(Pmid, 1)
    const x = qualityFromEnergy(f.h, g.h, f.v, g.v, G2, h0)
    const v = f.v + x * (g.v - f.v)
    const mu = 1 / Math.max(x / g.mu + (1 - x) / f.mu, 1e-12)
    const Re = (G * D) / Math.max(mu, 1e-9)
    const friction =
      Re > 2300 ? 0.316 * Math.pow(Re, -0.25) : 64 / Math.max(Re, 1)
    const phi2 =
      phiModel === 'app'
        ? 1 + 0.3 * x * Math.sqrt(Math.max(1, g.v / Math.max(f.v, 1e-12)))
        : 1 +
          (g.v / Math.max(f.v, 1e-12) - 1) *
            (x * (1 - x) + x * x * (g.v / Math.max(f.v, 1e-12)))
    const frictionGradient = (phi2 * friction * G2 * v) / (2 * D)

    const epsP = Math.max(100, dP * 0.02)
    const Plow = Math.max(Pmid - epsP, P_out * 0.999)
    const f2 = satPQ(Plow, 0)
    const g2 = satPQ(Plow, 1)
    const x2 = qualityFromEnergy(f2.h, g2.h, f2.v, g2.v, G2, h0)
    const v2 = f2.v + x2 * (g2.v - f2.v)
    const dvdp = (v - v2) / (Pmid - Plow)
    const momentum = 1 + G2 * dvdp
    const c2 = dvdp < 0 ? -(v * v) / dvdp : Number.NaN
    const velocity = G * v
    const isSonic =
      Number.isFinite(c2) && c2 > 0 && velocity > Math.sqrt(c2)

    if (verbose) {
      console.log(
        `  step ${i} P=${(Pmid / 1000).toFixed(1)} kPa x=${x.toFixed(3)} v=${v.toExponential(3)} G=${G.toFixed(1)} vel=${velocity.toFixed(2)} c=${Number.isFinite(c2) ? Math.sqrt(c2).toFixed(2) : 'nan'} dpdz=${(frictionGradient / 1000).toFixed(2)} kPa/m mom=${momentum.toFixed(4)}`,
      )
    }

    if (isSonic) {
      choked = true
      xOut = x
      P_out_actual = Pmid
      break
    }
    if (!(momentum > 0)) return null
    const dL = (Pa - Pb) / (frictionGradient / momentum)
    L += dL
    P = Pb
    xOut = x
    P_out_actual = Pb
  }

  return { L, xOut, choked, P_out_actual, dP_inlet, G, h0, v_in }
}

const Vd = 7.5e-6
const rpm = 3600
const Vdot = (Vd * rpm) / 60

const T_evap_ref = 273.15 - 23.3
const T_cond_ref = 273.15 + 54.4
const T_suc_ref = 273.15 + 32.2
const T_liq_ref = 273.15 + 32.2
const refEvap = satT(T_evap_ref, 1)
const refCond = satT(T_cond_ref, 0)
const refSuc = pt(refEvap.P, T_suc_ref)
const refLiq = pt(refCond.P, T_liq_ref)
const etaRef =
  218 / (Vdot * refSuc.rho * (refSuc.h - refLiq.h))

const T_evap = 273.15 - 23
const T_cond = 273.15 + 45
const T_suc_A = 273.15 - 10
const T_liq_A = 273.15 + 40
const evap = satT(T_evap, 1)
const cond = satT(T_cond, 0)
const refRatio = refCond.P / refEvap.P
const targetRatio = cond.P / evap.P
const exponent = 1.15
const residual = 0.025
const ratioTerm = (r) => Math.pow(Math.max(1, r), 1 / exponent) - 1
const clearance = clamp(
  (1 - residual - etaRef) / Math.max(ratioTerm(refRatio), 1e-6),
  0.002,
  0.45,
)
const etaTarget = clamp(
  1 - residual - clearance * ratioTerm(targetRatio),
  0.32,
  0.95,
)

const sucA = pt(evap.P, T_suc_A)
const liqA = pt(cond.P, T_liq_A)
const mDotA = Vdot * sucA.rho * etaTarget

console.log('=== COMPRESOR (CoolProp independiente) ===')
console.log(
  JSON.stringify(
    {
      Vdot,
      refEvapP: refEvap.P,
      refCondP: refCond.P,
      refSucRho: refSuc.rho,
      refSucH: refSuc.h,
      refLiqH: refLiq.h,
      etaRef,
      refRatio,
      targetRatio,
      clearance,
      etaTarget,
      evapP: evap.P,
      condP: cond.P,
      sucA: { rho: sucA.rho, h: sucA.h, cp: sucA.cp },
      liqA: { rho: liqA.rho, h: liqA.h, cp: liqA.cp },
      mDotA,
      capacityA: mDotA * (sucA.h - liqA.h),
    },
    null,
    2,
  ),
)

const D = 0.7e-3
const capA = capillaryLength({
  D,
  P_in: cond.P,
  P_out: evap.P,
  m_dot: mDotA,
  T_in: T_liq_A,
  steps: 800,
})

console.log('\n=== A: sin SLHX, D=0.7 mm ===')
console.log(
  JSON.stringify(
    {
      lengthM: capA?.L,
      xOut: capA?.xOut,
      choked: capA?.choked,
      P_out_actual: capA?.P_out_actual,
      capacityW: mDotA * (sucA.h - liqA.h),
      massFlowGps: mDotA * 1000,
    },
    null,
    2,
  ),
)

const slhx = ({ T_liq_in, T_suc_in, m_dot, L_cap, U = 38, D_suc = 0.0079375, percentage = 0.5, proper = true, capEps = true }) => {
  const liq = pt(cond.P, T_liq_in)
  const suc = pt(evap.P, T_suc_in)
  const cpL = liq.cp
  const cpV = suc.cp
  const Cmin = m_dot * Math.min(cpL, cpV)
  const Cmax = m_dot * Math.max(cpL, cpV)
  const Lwound = Math.min(L_cap * percentage, L_cap)
  const NTU = (U * Math.PI * D_suc * Lwound) / Cmin
  const Cr = Cmin / Cmax
  let epsilon
  if (!proper) {
    epsilon = 1 - Math.exp(-NTU)
  } else if (Math.abs(1 - Cr) < 1e-9) {
    epsilon = NTU / (1 + NTU)
  } else {
    epsilon =
      (1 - Math.exp(-NTU * (1 - Cr))) /
      (1 - Cr * Math.exp(-NTU * (1 - Cr)))
  }
  if (capEps) epsilon = Math.min(epsilon, 0.7)
  const dT = Math.max(0, T_liq_in - T_suc_in)
  const Q = epsilon * Cmin * dT
  return {
    Lwound,
    NTU,
    Cr,
    epsilon,
    Q,
    qPerMass: Q / m_dot,
    T_suc_out: T_suc_in + Q / (m_dot * cpV),
    T_liq_out: T_liq_in - Q / (m_dot * cpL),
    cpL,
    cpV,
  }
}

const runB = ({ proper = true, capEps = true, heatSign = 1, steps = 800, etaOverride = null, dParam = D }) => {
  const eta = etaOverride ?? etaTarget
  let m = Vdot * sucA.rho * eta
  let L = capillaryLength({
    D: dParam,
    P_in: cond.P,
    P_out: evap.P,
    m_dot: m,
    T_in: T_liq_A,
    steps,
  })?.L
  let info = null
  for (let iter = 0; iter < 80; iter += 1) {
    // Entradas reales del SLHX: líquido desde el condensador y succión desde
    // el evaporador. No se realimentan las salidas como si fueran entradas.
    const s = slhx({
      T_liq_in: T_liq_A,
      T_suc_in: T_suc_A,
      m_dot: m,
      L_cap: L,
      proper,
      capEps,
    })
    const sucOut = heatSign > 0 ? s.T_suc_out : 2 * T_suc_A - s.T_suc_out
    const liqOut = heatSign > 0 ? s.T_liq_out : 2 * T_liq_A - s.T_liq_out
    if (heatSign < 0 && sucOut < evap.T) {
      return {
        error: 'no físico: la succión quedaría por debajo de la saturación',
        T_suc_outC: sucOut - 273.15,
        T_satC: evap.T - 273.15,
        T_liq_outC: liqOut - 273.15,
        Q: s.Q,
        qPerMassKJkg: s.qPerMass / 1000,
        m,
        L,
        info: s,
      }
    }
    const sucOutSafe = Math.max(sucOut, evap.T + 0.05)
    const mNew = Vdot * pt(evap.P, sucOutSafe).rho * eta
    const capNew = capillaryLength({
      D: dParam,
      P_in: cond.P,
      P_out: evap.P,
      m_dot: mNew,
      T_in: liqOut,
      steps,
    })
    if (!capNew) return { error: 'capillary failed', iter, m, L, T_suc: sucOutSafe, T_liq: liqOut, s }
    info = s
    const dm = Math.abs(mNew - m) / Math.max(mNew, 1e-12)
    const dl = Math.abs(capNew.L - L) / Math.max(capNew.L, 1e-12)
    m = mNew
    L = capNew.L
    if (dm < 1e-7 && dl < 1e-7) {
      return {
        m,
        L,
        T_suc: sucOutSafe,
        T_liq: liqOut,
        T_suc_sat: evap.T - 273.15,
        T_suc_outC: sucOutSafe - 273.15,
        T_liq_outC: liqOut - 273.15,
        xOut: capNew.xOut,
        choked: capNew.choked,
        info,
        iterations: iter + 1,
        // Capacidad frigorífica del ciclo: efecto en el evaporador menos
        // entalpía del líquido subenfriado que entra al capilar.
        capacityW: m * (pt(evap.P, T_suc_A).h - pt(cond.P, liqOut).h),
      }
    }
  }
  return {
    m,
    L,
    T_suc: info?.T_suc_out ?? null,
    T_liq: info?.T_liq_out ?? null,
    xOut: null,
    choked: null,
    info,
    iterations: 80,
    capacityW: null,
  }
}

for (const opts of [
  { label: 'B ε-NTU propio, ε cap 0.7, signos correctos', proper: true, capEps: true, heatSign: 1 },
  { label: 'B ε-NTU propio, sin cap ε, signos correctos', proper: true, capEps: false, heatSign: 1 },
  { label: 'B modelo app ε=1-exp(-NTU), cap 0.7, signos correctos', proper: false, capEps: true, heatSign: 1 },
  { label: 'B signos invertidos (succión se enfría, líquido se calienta)', proper: true, capEps: true, heatSign: -1 },
]) {
  const r = runB(opts)
  console.log('\n=== ' + opts.label + ' ===')
  console.log(JSON.stringify(r, null, 2))
}

console.log('\n=== SENSIBILIDAD: mismo diámetro 0.7 mm, anclaje propio CoolProp ===')
const bBase = runB({ proper: true, capEps: true, heatSign: 1 })
console.log(
  JSON.stringify(
    {
      A: { L: capA.L, m: mDotA, capacity: mDotA * (sucA.h - liqA.h) },
      B: bBase,
      ratioBoverA: bBase.L / capA.L,
    },
    null,
    2,
  ),
)

// Anclaje al caudal de la app (1.490 g/s en A) para aislar el efecto
// del compresor del efecto del capilar + SLHX.
const mApp = 1.49039e-3
const etaApp = mApp / (Vdot * sucA.rho)
const capAApp = capillaryLength({
  D,
  P_in: cond.P,
  P_out: evap.P,
  m_dot: mApp,
  T_in: T_liq_A,
  steps: 800,
})
const bApp = runB({ proper: true, capEps: true, heatSign: 1, etaOverride: etaApp })
console.log('\n=== SENSIBILIDAD: mismo diámetro 0.7 mm, caudal anclado a la app ===')
console.log(
  JSON.stringify(
    {
      etaApp,
      A: { L: capAApp?.L, m: mApp, xOut: capAApp?.xOut },
      B: bApp,
      ratioBoverA: bApp.L / capAApp.L,
    },
    null,
    2,
  ),
)


// Tabla de paridad por diámetro, con el mismo anclaje de caudal.
console.log('\n=== PARIDAD POR DIÁMETRO (caudal anclado a la app) ===')
const table = []
for (const d of [0.6e-3, 0.7e-3, 0.8e-3]) {
  const a = capillaryLength({ D: d, P_in: cond.P, P_out: evap.P, m_dot: mApp, T_in: T_liq_A, steps: 800 })
  const b = runB({ proper: true, capEps: true, heatSign: 1, etaOverride: etaApp, dParam: d })
  table.push({
    D_mm: d * 1000,
    A: { L: a?.L, xOut: a?.xOut, mGps: mApp * 1000 },
    B: { L: b.L, xOut: b.xOut, mGps: b.m * 1000, epsilon: b.info?.epsilon, T_sucC: b.T_suc_outC, T_liqC: b.T_liq_outC },
    B_over_A: b.L / a.L,
  })
}
console.log(JSON.stringify(table, null, 2))


// Suelo físico: líquido a la temperatura de condensación (SC=0) y caudales
// del orden de los reportados. Ningún SLHX puede calentar el líquido por
// encima de T_cond sin convertirlo en vapor.
console.log('\n=== SUELO FÍSICO: SC=0, varios D y caudales ===')
const floorRows = []
for (const d of [0.6e-3, 0.7e-3, 0.8e-3]) {
  for (const mg of [1.4e-3, 1.5e-3, 1.6e-3]) {
    const r = capillaryLength({ D: d, P_in: cond.P, P_out: evap.P, m_dot: mg, T_in: T_cond - 0.02, steps: 800 })
    floorRows.push({ D_mm: d * 1000, mGps: mg * 1000, L_SC0: r?.L, xOut: r?.xOut })
  }
}
console.log(JSON.stringify(floorRows, null, 2))
