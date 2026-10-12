import { labelize } from '@ditojs/utils'
import {
  getSchemaValue as getValue,
  shouldRenderSchema
} from '../utils/schema/data.js'
import type { Context } from '../utils/schema/types.ts'
import type { Schema } from '../utils/types.ts'

export interface SchemaValueOptions {
  type?: any
  default?: any
  schema?: Schema | null
  callback?: boolean
}

// Resolve the callbacks of the schemas that the component renders with its
// `context`:
export function useSchemaValue(context: Context) {
  const getSchemaValue = (
    keyOrDataPath: string | string[],
    { schema = context.schema, ...options }: SchemaValueOptions = {}
  ) => getValue(keyOrDataPath, { ...options, schema, context })

  return {
    getSchemaValue,

    // Labels can be objects with affixes:
    getLabel(schema: Schema | null, name?: string): string | object {
      return schema
        ? getSchemaValue('label', { schema, type: [String, Object] }) ||
          labelize(name || schema.name)
        : labelize(name) || ''
    },

    shouldRenderSchema(schema: Schema | null = null): boolean {
      return shouldRenderSchema(schema, context)
    }
  }
}
