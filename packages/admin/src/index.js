import DitoAdmin from './DitoAdmin.js'
import { defineType as defineTypeDescriptor } from './utils/schema/types.ts'
import { wrapCustomComponent } from './types/DitoTypeComponent.vue'

export { DitoAdmin }
export default DitoAdmin

// Custom type components receive `schema`, `context` and `modelValue`, like the
// components of `type: 'component'`:
export function defineType({ component, ...descriptor }) {
  return defineTypeDescriptor({
    ...descriptor,
    component: wrapCustomComponent(component)
  })
}
