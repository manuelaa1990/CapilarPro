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

export type CompressorApplication = 'LBP' | 'MBP' | 'HBP'

export type TabId = 'calculator' | 'history' | 'model' | 'settings'

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
  refrigerantId: RefrigerantId
  compressorId: string
  compressorLabel: string
  standardId: StandardId
  application: CompressorApplication
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
  slhxEfectividad: number
  lHxM?: number
  installedDiameterMm: number | null
  installedLengthM: number | null
  notes: string
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
  correctionFactor: number
  alternatives: CapillaryCandidate[]
  selectedIsInstalled: boolean
  installedPrediction: {
    diameterMm: number
    modeledLengthM: number
    actualLengthM: number
    deviationPct: number
  } | null
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
  calibrationSamples: number
  method: string
}

export interface CalculationWarning {
  code: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
}

export interface CalculationResult {
  version: string
  calculatedAt: string
  fingerprint: string
  input: CalculationInput
  refrigerant: Refrigerant
  standard: StandardCondition
  referenceSaturation: SaturationPoint
  targetSaturation: SaturationPoint
  compressor: CompressorResult
  capillary: CapillaryResult
  uncertainty: UncertaintyResult
  warnings: CalculationWarning[]
  references: {
    model: string
    properties: string
    standards: string
  }
}

export interface ActualOutcome {
  diameterMm: number | null
  lengthM: number | null
  measuredEvapC: number | null
  measuredCapacityW: number | null
  modeledLengthAtActualM: number | null
  notes: string
  recordedAt: string
}

export interface SavedCase {
  id: string
  createdAt: string
  updatedAt: string
  fingerprint: string
  result: CalculationResult
  actual: ActualOutcome | null
  source: 'calculation' | 'demo' | 'imported'
}

export interface AppSettings {
  appName: string
  learningEnabled: boolean
  autoCalculate: boolean
  showAdvanced: boolean
}

export interface CalibrationSummary {
  factor: number
  samples: number
  scope: 'refrigerant' | 'global' | 'none'
  medianDeviationPct: number
  adjusted: boolean
}

export interface MemorySuggestion {
  diameterMm: number
  lengthM: number
  sampleCount: number
  similarity: number
  label: string
  refrigerantId: RefrigerantId
  lastSeen: string
}

export interface LearnedModel {
  calibration: CalibrationSummary
  byRefrigerant: Partial<Record<RefrigerantId, CalibrationSummary>>
  suggestion: MemorySuggestion | null
  actualCases: number
  totalCases: number
}

export interface StoredState {
  version: number
  settings: AppSettings
  cases: SavedCase[]
  lastUpdated: string
}
