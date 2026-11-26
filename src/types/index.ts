export type RefrigerantId =
  | 'R134a'
  | 'R600a'
  | 'R404A'
  | 'R290'
  | 'R22'
  | 'R507A'
  | 'R407C'
  | 'R417A'
  | 'R422D'
  | 'R427A'

export type CapacityUnit = 'W' | 'BTU/h'
export type DisplacementUnit = 'cm³/rev' | 'in³/rev'

export type StandardId =
  | 'ahri540'
  | 'en12900'
  | 'ahri-legacy'
  | 'gb-t'
  | 'custom'

export type CompressorApplication = 'LBP' | 'MBP' | 'CBP' | 'HBP'

export type TabId = 'calculator' | 'model'

export interface Refrigerant {
  id: RefrigerantId
  name: string
  family: string
  safety: string
  gwp: number
  odp: number
  criticalTempC: number
  glideK: number
  color: string
  applications: string
  notes: string
}

export interface StandardCondition {
  id: StandardId
  name: string
  shortName: string
  evapC: number
  condC: number
  superheatK: number
  subcoolK: number
  reference: string
  description: string
  isDefault: boolean
}

export interface Compressor {
  id: string
  brand: string
  model: string
  series: string
  refrigerants: RefrigerantId[]
  displacementCm3Rev: number
  rpm: number
  ratedCapacityW: number
  ratedEvapC: number
  ratedCondC: number
  ratedSuperheatK: number
  ratedSubcoolK: number
  standardId: StandardId
  application: string
  source: string
  fingerprintHash?: string
  isCustom?: boolean
}

export interface CalculationInput {
  /** Refrigerante con el que se declara la capacidad de placa. */
  refrigerantId: RefrigerantId
  /**
   * Refrigerante con el que debe operar el sistema. Si se omite, coincide con
   * `refrigerantId` y no hay cambio de fluido.
   */
  requiredRefrigerantId?: RefrigerantId
  compressorId: string
  compressorLabel: string
  standardId: StandardId
  application: CompressorApplication
  /**
   * Condición real en la que está declarada `ratedCapacity`. Si se omite, se
   * asume que coincide con `application` (misma aplicación).
   */
  declaredApplication?: CompressorApplication
  ratedCapacity: number
  capacityUnit: CapacityUnit
  displacement: number
  displacementUnit: DisplacementUnit
  frequencyHz: number
  refEvapC: number
  refCondC: number
  ambientTempC: number
  returnGasTempC: number
  refSuperheatK: number
  refSubcoolK: number
  targetEvapC: number
  targetCondC: number
  targetReturnGasTempC: number
  targetAmbientTempC: number
  targetSuperheatK: number
  targetSubcoolK: number
  slhxActivo: boolean
  slhxPorcentaje: number
  slhxDiametroSuccion:
    | '1/4'
    | '5/16'
    | '3/8'
    | '1/2'
    | '5/8'
    | '3/4'
    | '7/8'
  lHxM?: number
}

export interface SaturationPoint {
  temperatureC: number
  pressureKPa: number
  bubblePressureKPa: number
  dewPressureKPa: number
  liquidDensity: number
  vaporDensity: number
  latentHeatKJkg: number
  liquidEnthalpyKJkg: number
  vaporEnthalpyKJkg: number
  glideK: number
}

export interface ThermoState {
  pressureKPa: number
  temperatureC: number
  densityKgM3: number
  enthalpyKJkg: number
  entropyKJKgK: number
}

export interface CompressorResult {
  sweptVolumeM3s: number
  massFlowKgS: number
  capacityW: number
  etaVolumetricRef: number
  etaVolumetricTarget: number
  clearanceRatio: number
  referencePressureRatio: number
  targetPressureRatio: number
  suctionDensity: number
  suctionEnthalpy: number
  liquidEnthalpy: number
  enthalpyDifference: number
  anchored: boolean
  rawEtaVolumetricRef: number
}

export interface CapillaryCandidate {
  diameterMm: number
  lengthM: number
  rawLengthM: number
  massFluxKgM2s: number
  inletVelocityMs: number
  outletQuality: number
  outletPressureKPa: number
  choked: boolean
  status: 'recommended' | 'alternative' | 'short' | 'long' | 'unviable'
  note: string
}

export interface CapillaryResult {
  diameterMm: number
  lengthM: number
  innerDiameterMm: number
  massFluxKgM2s: number
  inletVelocityMs: number
  outletQuality: number
  outletPressureKPa: number
  pressureDropKPa: number
  choked: boolean
  /** Estado del candidato elegido. Opcional para leer casos guardados antiguos. */
  status?: CapillaryCandidate['status']
  /** Nota del candidato elegido. Opcional para leer casos guardados antiguos. */
  note?: string
  alternatives: CapillaryCandidate[]
}

export interface UncertaintyContribution {
  id: string
  label: string
  sigmaPct: number
  note: string
}

export interface UncertaintyResult {
  totalPct: number
  capacityPct: number
  lengthPct: number
  confidenceScore: number
  confidenceLabel: 'Alta' | 'Buena' | 'Moderada' | 'Baja'
  contributions: UncertaintyContribution[]
  interval: {
    diameterMm: [number, number]
    lengthM: [number, number]
  }
  method: string
}

export interface CalculationWarning {
  code: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
}

export interface CapacityNormalization {
  /** Capacidad tal como se declaró en la placa, en W. */
  originalCapacityW: number
  /** Capacidad llevada a la condición de aplicación, en W. */
  capacityW: number
  ratioUsed: number
  declaredApplication: CompressorApplication
  /** Refrigerante de diseño usado para el ancla de placa. */
  designRefrigerant: RefrigerantId
  /** Refrigerante requerido para el punto de operación. */
  requiredRefrigerant: RefrigerantId
  /** Verdadero cuando el fluido requerido difiere del de diseño. */
  refrigerantChanged: boolean
  method: 'ratio-table' | 'physics' | 'none' | 'refrigerant-change'
  warnings: CalculationWarning[]
}

export interface CalculationResult {
  version: string
  calculatedAt: string
  fingerprint: string
  input: CalculationInput
  /** Refrigerante de diseño (ancla de placa). */
  refrigerant: Refrigerant
  /** Alias explícito del refrigerante de diseño. */
  designRefrigerant: Refrigerant
  /** Refrigerante con el que se resuelve el punto requerido. */
  requiredRefrigerant: Refrigerant
  refrigerantChanged: boolean
  standard: StandardCondition
  referenceSaturation: SaturationPoint
  targetSaturation: SaturationPoint
  compressor: CompressorResult
  capillary: CapillaryResult
  capacityNormalization: CapacityNormalization
  slhx?: {
    lengthWoundM: number
    epsilonReal: number
    uWm2K: number
    suctionDiameterM: number
  } | null
  uncertainty: UncertaintyResult
  warnings: CalculationWarning[]
  references: {
    model: string
    properties: string
    standards: string
  }
}
