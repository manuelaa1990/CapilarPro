import standardsJson from './standards.json'
import refrigerantsJson from './refrigerants.json'
import compressorsJson from './compressors.json'
import solutionsJson from './solutions.json'
import defaultsJson from './defaults.json'
import correlationsJson from './correlations.json'
import type {
  Compressor,
  Refrigerant,
  RefrigerantId,
  StandardCondition,
  StandardId,
} from '../types'

export const standards = standardsJson.standards as StandardCondition[]
export const refrigerants = refrigerantsJson.refrigerants as Refrigerant[]
export const compressors = compressorsJson.compressors as Compressor[]
export const solutions = solutionsJson
export const defaults = defaultsJson
export const correlations = correlationsJson

export const standardById = (id: StandardId): StandardCondition =>
  standards.find((standard) => standard.id === id) ?? standards[0]

export const refrigerantById = (id: RefrigerantId): Refrigerant =>
  refrigerants.find((refrigerant) => refrigerant.id === id) ?? refrigerants[0]

export const compressorById = (id: string): Compressor | undefined =>
  compressors.find((compressor) => compressor.id === id)

export const supportedRefrigerants = refrigerants.map((refrigerant) => refrigerant.id)

export const appMeta = {
  name: 'CapilarPro',
  version: defaults.version,
  modelVersion: correlations.modelVersion,
  dataUpdatedAt: standardsJson.updatedAt,
  propertySource: refrigerantsJson.propertySource,
}
