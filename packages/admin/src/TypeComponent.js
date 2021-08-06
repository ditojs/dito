// TypeComponent is the abstract base component for all other type components
// inside the types/ folder. There's also a separate concrete
// `TypeComponent.vue` component, use to render the `type: 'component'` types.
import DitoComponent from './DitoComponent'
import TypeMixin from './mixins/TypeMixin'
import { registerTypeComponent, getTypeComponent } from '@/utils/schema'
import { asArray } from '@ditojs/utils'

const TypeComponent = DitoComponent.extend({
  mixins: [TypeMixin],

  // Set reasonable defaults for all of these that are used by most type
  // components. These only need defining in sub-classes when they differ.
  defaultValue: null,
  defaultNested: true,
  defaultVisible: true,
  generateLabel: true,
  excludeValue: false,
  ignoreMissingValue: null,
  omitPadding: false
})

TypeComponent.register = function(types, definition = {}) {
  types = asArray(types)
  const component = this.component(`dito-type-${types[0]}`, definition)
  for (const type of types) {
    registerTypeComponent(type, component)
  }
  return component
}

TypeComponent.get = getTypeComponent

export default TypeComponent
