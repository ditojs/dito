import { deprecate } from '@ditojs/utils'
import DitoAdmin from './DitoAdmin.js'
import { getSchemaValue as getValue } from './utils/schema/data.js'
import { defineType as defineTypeDescriptor } from './utils/schema/types.ts'
import { wrapCustomComponent } from './types/DitoTypeComponent.vue'

export { DitoAdmin }
export { numberTraits, optionsTraits, textTraits } from './types/traits.ts'
export default DitoAdmin

// Custom type components receive `schema`, `context` and `modelValue`, like the
// components of `type: 'component'`:
export function defineType({ component, ...descriptor }) {
  return defineTypeDescriptor({
    ...descriptor,
    component: wrapCustomComponent(component)
  })
}

export function getSchemaValue(schema, key, context) {
  deprecate(
    '`getSchemaValue(schema, key, context)` is deprecated, use ' +
    '`context.getSchemaValue(key)` instead.'
  )
  return getValue(key, { schema, context })
}
