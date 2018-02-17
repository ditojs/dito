import Vue from 'vue'
import VueNotifications from 'vue-notification'
import VueDraggable from 'vuedraggable'
import VueToggleButton from 'vue-js-toggle-button'
import DitoSpinner from 'vue-spinner/src/PulseLoader'
import DitoMixin from './mixins/DitoMixin'
import TypeMixin from './mixins/TypeMixin'
import { isFunction, isPromise } from '@ditojs/utils'

const components = {}
const typeComponents = {}

const DitoComponent = Vue.extend({
  mixins: [DitoMixin],
  // Make sure that registered components are present in all DitoComponent.
  components,

  methods: {
    getTypeComponent(type) {
      return typeComponents[type] || null
    },

    resolveTypeComponent(component) {
      // A helper method to allow three things:
      // - When used in a computed property, it removes the need to have to
      //   load components with async functions `component: () => import(...)`.
      //   instead, they can be directly provided: `component: import(...)`
      // - The properties passed to such components don't need to be defined.
      //   Instead, the default TypeMixin props are automatically set.
      // - The component can use all internal components known to dito-admin.
      return component
        ? async () => {
          // At first, resolve component is it is loaded asynchronously.
          let comp = isFunction(component) ? await component()
            : isPromise(component) ? await component
            : component
          comp = comp?.default || comp
          comp.props = TypeMixin.props
          comp.components = components
          return comp
        }
        : component
    }
  }
})

DitoComponent.typeComponents = typeComponents

DitoComponent.component = function (name, options) {
  const ctor = this.extend(options)
  components[name] = ctor
  return ctor
}

DitoComponent.get = function (name) {
  return components[name]
}

// Register "global" components and plugins, on the DitoComponent level so
// the global Vue is not polluted.
DitoComponent.use(VueNotifications)
DitoComponent.use(VueToggleButton)
DitoComponent.component('vue-draggable', VueDraggable)
DitoComponent.component('dito-spinner', DitoSpinner)

export default DitoComponent
