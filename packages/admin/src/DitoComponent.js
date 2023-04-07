import DitoMixin from './mixins/DitoMixin.js'
import { getTypeComponent } from './utils/schema.js'
import { resolveMergedOptions } from './utils/options.js'
import { isPlainObject } from '@ditojs/utils'

const components = {}

// @vue/component
export default {
  mixins: [DitoMixin],
  // Make sure that registered components are present in all DitoComponent.
  components,

  component(name, definition) {
    if (definition) {
      if (isPlainObject(definition)) {
        definition = resolveMergedOptions({
          extends: this,
          name,
          ...definition
        })
      }
      components[name] = definition
    }
    return components[name]
  },

  methods: {
    getTypeComponent
  }
}
