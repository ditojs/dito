import Vue from 'vue'
import escape from './utils/escape'

let components = []
let types = []

let DitoComponent = Vue.extend({
  // Make sure that registered components are present in all DitoComponent.
  components: components,

  methods: {
    typeToComponent(type) {
      return types[type]
    },

    escape
  }
})

DitoComponent.component = function(name, options) {
  let ctor = this.extend(Object.assign({
    name: name
  }, options))
  components[name] = ctor
  return ctor
}

DitoComponent.type = function(type, options) {
  let name = `dito-${type}`
  types[type] = name
  let props = options && options.props
  return this.component(name, Object.assign({}, options, {
    props: Array.isArray(props)
        ? ['name', 'desc', 'data'].concat(props)
        : Object.assign({
          name: { type: String, required: true },
          desc: { type: Object, required: true },
          data: { type: Object, required: true }
        }, props)
  }))
}

DitoComponent.get = function(type) {
  return components[types[type]]
}

export default DitoComponent
