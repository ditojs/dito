import { asArray, isString } from '@ditojs/utils'
import type { Component } from 'vue'
import type {
  ApiConfig,
  TypeDescriptor as PublicTypeDescriptor
} from '../../../types/index.d.ts'
import type { Schema } from '../types.ts'

export type Context = Record<string, any>

// The members that only dito's own types use:
export type TypeDescriptor = PublicTypeDescriptor & {
  // Only multiselects read `search` from their schema:
  readonly hasSearch?: boolean
  // Lists show their buttons in the row of their label:
  readonly hasLabelButtons?: boolean
  // Sources hold their items in a list or an object:
  readonly sourceType?: 'list' | 'object'
  // Parse the value that the component edits, before the schema's
  // `parseValue()`:
  parseValue?(context: Context): any
  // The type of the field's data as a property of the server's models, which
  // `getFormProperties()` completes with the field's other data keywords.
  // `schema` is the field without callbacks, `context.schema` the field:
  getProperty?(schema: Schema, context: Context): Record<string, any> | null
  // The sources routed next to the forms of the items, e.g. of trees:
  getChildSourceSchemas?(schema: Schema): Schema[]
  getItemAdapter?(schema: Schema): ItemAdapter | null
  getPanelSchema?(
    api: ApiConfig,
    schema: Schema,
    dataPath: string,
    // The list that the component renders, e.g. for the panel of its filters:
    source: {
      readonly listQuery: {
        readonly query: Record<string, any>
        update(
          changes: Record<string, any>,
          options?: { resetPage?: boolean }
        ): Promise<unknown>
      }
    } | null
  ): Schema | null | undefined
}

// Wrap the primitive values of a list in objects for the forms of its items to
// edit, and unwrap them again:
export interface ItemAdapter {
  // The component that edits the value shares the data path of the item:
  readonly name: string
  wrap(value: any): Record<string, any>
  unwrap(item: Record<string, any>): any
}

const typeDefaults = {
  defaultValue: null,
  defaultNested: true,
  defaultVisible: true,
  generatesLabel: true,
  alignsBelowLabels: true
}

// The members of the public `TypeDescriptor` that custom types may define,
// besides the ones that the public `defineType()` handles itself:
export const publicDescriptorKeys = new Set(
  Object.keys({
    type: true,
    defaultValue: true,
    defaultNested: true,
    defaultVisible: true,
    defaultMultiple: true,
    defaultWidth: true,
    defaultExclude: true,
    ignoresMissingValue: true,
    resolvesValue: true,
    generatesLabel: true,
    hasLabel: true,
    omitsSpacing: true,
    rendersLabel: true,
    alignsBelowLabels: true,
    submitsData: true,
    hasEmbeddedForms: true,
    getOptionsDataSchema: true,
    getDisplayValue: true,
    getValidations: true,
    getProperty: true,
    setupSchema: true,
    deserializeValue: true,
    serializeValue: true
  } satisfies Record<
    Exclude<keyof PublicTypeDescriptor, 'component' | 'override'>,
    true
  >)
)

const descriptorsByType: Record<string, TypeDescriptor> = {}

const unknownTypeReported: Record<string, boolean> = {}

export function defineType(descriptor: TypeDescriptor): TypeDescriptor {
  const typeDescriptor = { ...typeDefaults, ...descriptor }
  for (const type of asArray(descriptor.type)) {
    descriptorsByType[type] = typeDescriptor
  }
  return typeDescriptor
}

export function getTypes(): string[] {
  return Object.keys(descriptorsByType)
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
): TypeDescriptor['sourceType'] | null {
  return getTypeDescriptor(schemaOrType)?.sourceType ?? null
}

export function getChildSourceSchemas(schema: Schema): Schema[] {
  return getTypeDescriptor(schema)?.getChildSourceSchemas?.(schema) ?? []
}

export function getItemAdapter(schema: Schema | null): ItemAdapter | null {
  return (schema && getTypeDescriptor(schema)?.getItemAdapter?.(schema)) ?? null
}

export function getOptionsDataSchema(schema: Schema): any {
  return getTypeDescriptor(schema)?.getOptionsDataSchema?.(schema) ?? null
}
