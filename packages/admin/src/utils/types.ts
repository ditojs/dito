import type { ApiConfig } from '../../types/index.d.ts'

// The schemas, data and resources that the admin's modules handle, which they
// don't type further:
export type Schema = Record<string, any>
export type Data = Record<string, any>
export type Resource = Record<string, any>

// The API configuration with the defaults that `DitoAdmin` sets up:
export type Api = ApiConfig &
  Required<
    Pick<
      ApiConfig,
      | 'locale'
      | 'formats'
      | 'request'
      | 'getApiUrl'
      | 'isApiUrl'
      | 'normalizePath'
      | 'denormalizePath'
      | 'users'
      | 'resources'
      | 'headers'
      | 'defaults'
    >
  >

// The components that `processSchemaData()` walks, with the data they edit:
export interface SchemaDataEntry {
  schema: Schema
  data: Data
  name: string
  dataPath: string | null
  componentPath: string
  processedData: Data | null
}

// Tabs and panels are walked without a name:
export type ProcessedEntry = Omit<SchemaDataEntry, 'name'> & {
  name: string | null
}

export interface SchemaDataWalk {
  dataPath?: string | null
  componentPath?: string
  processedData?: Data | null
  wrappedValueName?: string | null
  childSourceSchemas?: Schema[]
  before?: ((entry: SchemaDataEntry) => void) | null
  after?: ((entry: SchemaDataEntry) => void) | null
  shouldProcess?: (entry: ProcessedEntry) => boolean
  shouldSkipSourcesWithResource?: boolean
  options: { services: object | null; rootData: Data | null }
}
