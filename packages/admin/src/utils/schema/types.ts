import { isString } from '@ditojs/utils'
import type { Component } from 'vue'
import type {
  ItemAdapter,
  TypeDescriptor as PublicTypeDescriptor
} from '../../../types/index.d.ts'
import type { Schema } from '../types.ts'

export type Context = Record<string, any>
export type TypeDescriptor = PublicTypeDescriptor

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
