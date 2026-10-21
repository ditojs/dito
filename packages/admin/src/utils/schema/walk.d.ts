import type { Data, Schema } from '../types.ts'

interface ValueError {
  message: string
}

interface DefaultValueOptions {
  shouldSetDefaultsOfComponentsWithCompute?: boolean
}

// The source of the items in a value:
export interface DataSource {
  isSource: boolean
  isList: boolean
  hasForms: boolean
  idKey: string
  orderKey: string | null
  hasItemTypes: boolean
  hasResource: boolean
  itemAdapter: {
    name: string
    wrap: (value: any) => Data
    unwrap: (item: Data) => any
  } | null
}

// A value of the data, which answers for it. Only fields hold `fields`:
export interface DataNode {
  name: string
  fields: { schema: Schema; name: string | null }[]
  source: DataSource | null
  getValidationErrors(entry: DataEntry): ValueError[]
  hasMissingValue(entry: DataEntry, options?: DefaultValueOptions): boolean
  getDefaultValue(entry: DataEntry, options?: DefaultValueOptions): any
  deserialize(value: any, entry: DataEntry): any
  serialize(value: any, entry: DataEntry): any
  isExcluded(entry: DataEntry): boolean
  getRecordedValue(): { schema: Schema; form: Schema } | null
}

export function getSchemaSource(schema: Schema): DataSource

// The value at a node that `walkData()` visits, with the data that holds it:
export interface DataEntry {
  node: DataNode
  data: Data
  name: string
  dataPath: string | null
  // The data path of `data`, which wrapped values keep:
  itemDataPath: string | null
  // The copy of `data` that the walk builds, if any, and of the root data:
  serializedData: Data | null
  serializedRootData: Data | null
  services: object | null
  rootData: Data | null
}

// A field of the value of an entry:
export type FieldEntry = Omit<DataEntry, 'node'> & { schema: Schema }

// The fields and containers that `walkData()` walks. Tabs and panels have no
// name:
export type WalkedDataEntry = Omit<FieldEntry, 'name'> & { name: string | null }

export function walkData(
  schema: Schema,
  data: Data,
  options: {
    dataPath?: string | null
    services?: object | null
    rootData?: Data | null
    serializedData?: Data | null
    shouldWalk?: (entry: WalkedDataEntry) => boolean
    shouldVisit?: (entry: DataEntry) => boolean
    shouldSkipSourcesWithResource?: boolean
    shouldSkipIrrelevant?: boolean
    visit: (entry: DataEntry) => void
    after?: ((entry: DataEntry) => void) | null
  }
): Data
