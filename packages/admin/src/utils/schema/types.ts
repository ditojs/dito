import { isString } from '@ditojs/utils'
import type { Component } from 'vue'
import type { SourceContext } from '../SourceContext.ts'
import type { Api, Data, Schema } from '../types.ts'

// The `DitoContext` of the component, see `DitoContext.js`:
export type Context = Record<string, any>
type ContextCallback<T> = (context: Context) => T

export type SourceType = 'list' | 'object'

// Wraps the items of a source for the forms that edit them, e.g. primitive
// values in objects, and unwraps them again.
export interface ItemAdapter {
  // The name of the component that edits the value. It shares the data path
  // of the item, where the errors of the value are mapped to:
  readonly name: string
  wrap(value: any): Data
  unwrap(item: Data): any
}

// Describes a type of schema components: the component that renders it, and
// how the generic code of the admin handles its schemas and values, also when
// they aren't rendered.
export interface TypeDescriptor {
  readonly types: string[]
  readonly component: Component
  // The defaults of the schema settings of the same name: `default`,
  // `nested`, `visible`, `multiple`, `width` and `exclude`:
  readonly defaultValue?: any
  readonly defaultNested?: boolean
  readonly defaultVisible?: boolean
  readonly defaultMultiple?: boolean
  readonly defaultWidth?: string | number
  readonly excludeValue?: boolean | ContextCallback<boolean>
  // Values that are missing don't get their defaults, e.g. passwords:
  readonly ignoreMissingValue?: ContextCallback<boolean>
  // Values that are `null` get their defaults, e.g. the objects of sections:
  readonly treatNullAsMissing?: ContextCallback<boolean>
  // The value is resolved from `schema.data` or `schema.dataPath`:
  readonly valueFromDataSchema?: boolean
  // Whether components without `label` get one generated from their name:
  readonly generateLabel?: boolean
  // Whether the component displays its label itself, e.g. in a header:
  readonly rendersOwnLabel?: ContextCallback<boolean>
  readonly omitSpacing?: boolean
  // Labels are replaced by the label of their container, if they have one:
  readonly isLabel?: boolean
  readonly isButton?: boolean
  // Whether the button submits the data of its form, see `hasSubmitButton()`:
  readonly submitsData?: boolean
  // Sources hold their items in a list or an object, edited in forms:
  readonly sourceType?: SourceType
  // Whether the forms of the items render inside the form or view of their
  // source, instead of in their own routes:
  readonly hasNestedForms?: boolean
  // The sources that hold the children of items, routed next to the forms of
  // their items, e.g. of trees:
  getChildSourceSchemas?(schema: Schema): Schema[]
  getItemAdapter?(schema: Schema): ItemAdapter | null
  // The data schema of the options, see `DataSchemaResolver`:
  getOptionsDataSchema?(schema: Schema): any
  getPanelSchema?(
    api: Api,
    schema: Schema,
    dataPath: string,
    source: SourceContext | null
  ): Schema | null | undefined
  getValidations?(schema: Schema, context: Context): Record<string, any>
  // Set up the schema, e.g. resolve the schemas that it contains:
  processSchema?(api: Api, schema: Schema, name: string): Promise<any> | void
  // Convert the value for storage, see `processData()`:
  processValue?(context: Context, graph: any): any
}

const typeDefaults = {
  defaultValue: null,
  defaultNested: true,
  defaultVisible: true,
  generateLabel: true
}

const descriptorsByType: Record<string, TypeDescriptor> = {}

const unknownTypeReported: Record<string, boolean> = {}

export function defineType(descriptor: TypeDescriptor): TypeDescriptor {
  const typeDescriptor = { ...typeDefaults, ...descriptor }
  for (const type of descriptor.types) {
    descriptorsByType[type] = typeDescriptor
  }
  return typeDescriptor
}

export function getTypeDescriptor(
  schemaOrType: Schema | string | null | undefined
): TypeDescriptor | null {
  const type = isString(schemaOrType) ? schemaOrType : schemaOrType?.type
  return descriptorsByType[type] ?? null
}

export function getTypeComponent(type: string): Component | null {
  const component = getTypeDescriptor(type)?.component ?? null
  if (!component && !unknownTypeReported[type]) {
    // Report each missing type only once, to avoid flooding the console:
    unknownTypeReported[type] = true
    throw new Error(`Unknown Dito.js component type: '${type}'`)
  }
  return component
}

export function getSourceType(
  schemaOrType: Schema | string | null | undefined
): SourceType | null {
  return getTypeDescriptor(schemaOrType)?.sourceType ?? null
}

export function getChildSourceSchemas(schema: Schema): Schema[] {
  return getTypeDescriptor(schema)?.getChildSourceSchemas?.(schema) ?? []
}

export function getItemAdapter(schema: Schema | null): ItemAdapter | null {
  return (schema && getTypeDescriptor(schema)?.getItemAdapter?.(schema)) ?? null
}
