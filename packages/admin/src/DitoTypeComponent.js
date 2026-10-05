// DitoTypeComponent is the abstract base component for all other type
// components inside the types/ folder. There's also a separate concrete
// `DitoTypeComponent.vue` component, use to render `{ type: 'component' }`
import { asArray, camelize } from '@ditojs/utils'
import DitoComponent from './DitoComponent.js'
import TypeMixin from './mixins/TypeMixin.js'
import {
  registerTypeComponent,
  getTypeComponent
} from './utils/schema/types.js'

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
  defaultMultiple: false,
  generateLabel: true,
  excludeValue: false,
  ignoreMissingValue: null,
  treatNullAsMissing: null,
  omitSpacing: false,
  getTypeValidations: null,

  component: DitoComponent.component,

  get: getTypeComponent,

  register(types, definition = {}) {
    types = asArray(types)
    if (hasValidationsMethod(definition)) {
      // Validation doesn't depend on components anymore, so that it also
      // covers fields that aren't rendered, see `utils/schema/validation.js`.
      console.warn(
        `Type '${types[0]}': The \`getValidations()\` method isn't supported ` +
        `anymore, use the static \`getTypeValidations(schema, context)\` ` +
        `option instead.`
      )
    }
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

// Returns whether the component definition or one of its mixins defines the
// `getValidations()` method that types used to override.
function hasValidationsMethod(definition) {
  return [definition, ...(definition.mixins ?? [])].some(
    ({ methods }) => !!methods?.getValidations
  )
}
