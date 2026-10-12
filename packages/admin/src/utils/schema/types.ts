import { isString } from '@ditojs/utils'
import type { Component } from 'vue'
import type { SourceContext } from '../SourceContext.ts'
import type { Api, Data, Schema } from '../types.ts'

export type Context = Record<string, any>
type ContextCallback<T> = (context: Context) => T

export type SourceType = 'list' | 'object'

// Wraps the items of a source for the forms that edit them, e.g. primitive
// values in objects, and unwraps them again. The component `name` edits the
// value, and shares the data path of the item:
export interface ItemAdapter {
  readonly name: string
  wrap(value: any): Data
  unwrap(item: Data): any
}

// Describes a type of schema components: the component that renders it, and
// how the admin handles its schemas and values, also when they aren't
// rendered. Its options tell the admin what to do for the type, and are
// documented in `index.d.ts`.
export interface TypeDescriptor {
  readonly types: string[]
  readonly component: Component
  readonly defaultValue?: any
  readonly defaultNested?: boolean
  readonly defaultVisible?: boolean
  readonly defaultMultiple?: boolean
  readonly defaultWidth?: string | number
  readonly excludeValue?: boolean | ContextCallback<boolean>
  readonly ignoreMissingValue?: ContextCallback<boolean>
  readonly treatNullAsMissing?: ContextCallback<boolean>
  readonly resolveValue?: boolean
  readonly generateLabel?: boolean
  readonly omitLabel?: ContextCallback<boolean>
  readonly omitSpacing?: boolean
  readonly replaceWithLabel?: boolean
  readonly submitData?: boolean
  readonly sourceType?: SourceType
  readonly nestForms?: boolean
  getChildSourceSchemas?(schema: Schema): Schema[]
  getItemAdapter?(schema: Schema): ItemAdapter | null
  getOptionsDataSchema?(schema: Schema): any
  getPanelSchema?(
    api: Api,
    schema: Schema,
    dataPath: string,
    source: SourceContext | null
  ): Schema | null | undefined
  getValidations?(schema: Schema, context: Context): Record<string, any>
  processSchema?(api: Api, schema: Schema, name: string): Promise<any> | void
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

export function getOptionsDataSchema(schema: Schema): any {
  return getTypeDescriptor(schema)?.getOptionsDataSchema?.(schema) ?? null
}
