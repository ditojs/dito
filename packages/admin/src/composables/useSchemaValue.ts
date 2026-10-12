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

// Read the values of the component's schema, or of other schemas that it
// renders, resolving their callbacks with the component's `context`, see
// `getSchemaValue()` in `utils/schema/data.js`.
export function useSchemaValue(context: Context) {
  const getSchemaValue = (
    keyOrDataPath: string | string[],
    { schema = context.schema, ...options }: SchemaValueOptions = {}
  ) => getValue(keyOrDataPath, { ...options, schema, context })

  return {
    getSchemaValue,

    // The label of the schema, which can be an object with affixes, or else
    // its name, labelized:
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
