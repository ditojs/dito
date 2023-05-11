// DitoTypeComponent is the abstract base component for all other type
// components inside the types/ folder. There's also a separate concrete
// `DitoTypeComponent.vue` component, use to render `{ type: 'component' }`
import { asArray, camelize } from '@ditojs/utils'
import DitoComponent from './DitoComponent.js'
import TypeMixin from './mixins/TypeMixin.js'
import { registerTypeComponent, getTypeComponent } from './utils/schema.js'

// @vue/component
export default {
  extends: DitoComponent,
  mixins: [TypeMixin],

  nativeField: false,
  textField: false,
  // Set reasonable defaults for all of these that are used by most type
  // components. These only need defining in sub-classes when they differ.
  defaultValue: null,
  defaultNested: true,
  defaultVisible: true,
  generateLabel: true,
  excludeValue: false,
  ignoreMissingValue: null,
  omitSpacing: false,

  component: DitoComponent.component,

  get: getTypeComponent,

  register(types, definition = {}) {
    types = asArray(types)
    const component = this.component(
      `DitoType${camelize(types[0], true)}`,
      definition
    )
    for (const type of types) {
      registerTypeComponent(type, component)
    }
    return component
  }
}
