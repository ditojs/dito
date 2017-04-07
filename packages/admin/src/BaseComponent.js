import Vue from 'vue'
import escape from './utils/escape'

let components = []
let types = []

let BaseComponent = Vue.extend({
  // Make sure that registered components are present in all BaseComponent.
  components: components,

  methods: {
    typeToComponent(type) {
      return types[type]
    },

    escape
  }
})

BaseComponent.component = function(name, options) {
  let ctor = this.extend(Object.assign({
    name: name
  }, options))
  components[name] = ctor
  return ctor
}

BaseComponent.type = function(type, options) {
  let name = `dito-${type}`
  types[type] = name
  let props = options && options.props
  return this.component(name, Object.assign({}, options, {
    props: Array.isArray(props)
        ? ['name', 'desc', 'data', 'disabled'].concat(props)
        : Object.assign({
          name: { type: String, required: true },
          desc: { type: Object, required: true },
          data: { type: Object, required: true },
          disabled: { type: Boolean, required: false }
        }, props)
  }))
}

BaseComponent.get = function(type) {
  return components[types[type]]
}

export default BaseComponent
