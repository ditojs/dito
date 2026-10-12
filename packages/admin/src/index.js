import DitoAdmin from './DitoAdmin.js'
import { getSchemaValue as getValue } from './utils/schema/data.js'

export { DitoAdmin }
export { defineType } from './utils/schema/types.ts'
export default DitoAdmin

// Returns the value of `key` in the schema of a custom component, calling it
// with the component's `context` if it's a function.
export function getSchemaValue(schema, key, context) {
  return getValue(key, { schema, context })
}
