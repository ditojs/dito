import DitoAdmin from './DitoAdmin.js'
import { getSchemaValue as getValue } from './utils/schema/data.js'
import { defineType as defineTypeDescriptor } from './utils/schema/types.ts'
import { wrapCustomComponent } from './types/DitoTypeComponent.vue'

export { DitoAdmin }
export { numberTraits, optionsTraits, textTraits } from './types/traits.ts'
export default DitoAdmin

// Define a custom type, whose component receives the `schema`, its `context`
// and the value as `modelValue`, like the components of `type: 'component'`.
export function defineType({ component, ...descriptor }) {
  return defineTypeDescriptor({
    ...descriptor,
    component: wrapCustomComponent(component)
  })
}

// Returns the value of `key` in the schema of a custom component, calling it
// with the component's `context` if it's a function.
export function getSchemaValue(schema, key, context) {
  return getValue(key, { schema, context })
}
