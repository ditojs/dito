import {
  getSchemaValue as getValue,
  getLabel,
  shouldRenderSchema,
  type Label
} from '../utils/schema/value.js'
import { getText } from '../utils/html.js'
import type { Context } from '../utils/schema/types.ts'
import type { Schema } from '../utils/types.ts'

export interface SchemaValueOptions {
  type?: any
  default?: any
  schema?: Schema | null
  context?: Context
  callback?: boolean
}

// Resolve the callbacks of the schemas that the component renders with its
// `context`, unless a call passes its own, e.g. uploads pass one per file:
export function useSchemaValue(context: Context) {
  const getSchemaValue = (
    keyOrDataPath: string | string[],
    {
      schema = context.schema,
      context: valueContext = context,
      ...options
    }: SchemaValueOptions = {}
  ) => getValue(keyOrDataPath, { ...options, schema, context: valueContext })

  return {
    getSchemaValue,

    getLabel(schema: Schema | null, name?: string): Label {
      return getLabel(schema, context, name)
    },

    getLabelText(schema: Schema | null, name?: string): string {
      return getText(getLabel(schema, context, name))
    },

    shouldRenderSchema(schema: Schema | null = null): boolean {
      return shouldRenderSchema(schema, context)
    }
  }
}
