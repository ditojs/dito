import type { Data, Schema } from '../types.ts'
import type { UploadLimits } from '../upload.ts'

interface ValueError {
  message: string
}

interface DefaultValueOptions {
  shouldSetDefaultsOfComputedValues?: boolean
}

// The source of the items in a value:
export interface DataSource {
  isList: boolean
  hasForms: boolean
  idKey: string
  orderKey: string | null
  hasItemTypes: boolean
  hasResource: boolean
  hasSubmitButton: boolean
  itemAdapter: {
    name: string
    wrap: (value: any) => Data
    unwrap: (item: Data) => any
  } | null
}

// The relation of a value to records, by the schema that relates them:
export interface DataRelation {
  schema: Schema
  hasOptions: boolean
}

// A value of the data, which answers for it:
export interface DataNode {
  name: string
  source: DataSource | null
  relation: DataRelation | null
  getRelevantNode(entry: DataEntry): DataNode | null
  // The node of the value's property, `null` for types without a value:
  getPropertyNode(entry: DataEntry): PropertyNode | null
  getRecordedSchema(entry: DataEntry): { schema: Schema; form: Schema } | null
  getItemForms(entry: DataEntry): {
    forms: Record<string, Schema>
    childSourceSchemas: Schema[]
  }[]
}

// The node of a value's property, which describes its data:
export interface PropertyNode {
  name: string
  getRecordedSchema(entry: DataEntry): { schema: Schema; form: Schema } | null
  getValidationErrors(entry: DataEntry): ValueError[]
  shouldSetDefaultValue(
    entry: DataEntry,
    options?: DefaultValueOptions
  ): boolean
  setDefaultValue(entry: DataEntry, options?: DefaultValueOptions): void
  getDefaultValue(entry: DataEntry): any
  getEmptyValue(entry: DataEntry): any
  getValueOrDefault(entry: DataEntry): any
  deserialize(value: any, entry: DataEntry): any
  serialize(value: any, entry: DataEntry): any
  isExcluded(entry: DataEntry, values?: Record<string, any> | null): boolean
  getUploadLimits(entry: DataEntry): UploadLimits | null
  getDisplayValue(entry: DataEntry): any
}

// The node of a written property, which walks visit as a value of the data:
export interface WrittenPropertyNode extends PropertyNode, DataNode {
  isRelevant(entry: DataEntry): boolean
}

export function getSchemaSource(schema: Schema): DataSource

// The forms of the items of a source, and its child sources:
export interface ItemForms {
  forms: Record<string, Schema>
  childSourceSchemas: Schema[]
}

interface FieldNodesOptions {
  services: object | null
  rootData: Data | null
}

export function getFieldNodes(
  schema: Schema,
  data: Data,
  dataPath: string | null,
  options: FieldNodesOptions
): Map<string, DataNode>

export function getItemNodes(
  sources: ItemForms[],
  item: Data,
  dataPath: string | null,
  options: FieldNodesOptions
): Map<string, DataNode> | null

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

export function walkData(
  schema: Schema,
  data: Data,
  options: {
    dataPath?: string | null
    // The source of `data`, when the walk starts at one of its items:
    sourceSchema?: Schema | null
    services?: object | null
    rootData?: Data | null
    serializedData?: Data | null
    shouldWalk?: (entry: DataEntry) => boolean
    shouldVisit?: (entry: DataEntry) => boolean
    shouldSkipSourcesWithResource?: boolean
    shouldSkipIrrelevant?: boolean
    visit: (entry: DataEntry) => void
    after?: ((entry: DataEntry) => void) | null
  }
): Data
