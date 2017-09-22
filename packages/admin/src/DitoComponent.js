import Vue from 'vue'
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

export default DitoComponent
