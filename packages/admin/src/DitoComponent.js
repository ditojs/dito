import Vue from 'vue'
import VueNotifications from 'vue-notification'
import VueDraggable from 'vuedraggable'
import VueToggleButton from 'vue-js-toggle-button'
import DitoSpinner from 'vue-spinner/src/PulseLoader'
import DitoMixin from './mixins/DitoMixin'

const components = {}
const typeComponents = {}

const DitoComponent = Vue.extend({
  mixins: [DitoMixin],
  // Make sure that registered components are present in all DitoComponent.
  components,

  methods: {
    getTypeComponent(type) {
      return typeComponents[type] || null
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
