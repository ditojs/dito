import type { Data, Schema } from '../types.ts'

interface ValueError {
  message: string
}

interface DefaultValueOptions {
  shouldSetDefaultsOfComponentsWithCompute?: boolean
}

// A value with the fields that edit it, which answers for the value:
export declare class FieldNode {
  name: string
  fields: { schema: Schema; name: string | null }[]
  constructor(name: string, fields?: FieldNode['fields'])
  getValidationErrors(entry: DataEntry): ValueError[]
  hasMissingValue(entry: DataEntry, options?: DefaultValueOptions): boolean
  getDefaultValue(entry: DataEntry, options?: DefaultValueOptions): any
  deserialize(value: any, entry: DataEntry): any
  serialize(value: any, entry: DataEntry): any
  isExcluded(entry: DataEntry): boolean
}

// The value at a node that `walkData()` visits, with the data that holds it:
export interface DataEntry {
  node: FieldNode
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
