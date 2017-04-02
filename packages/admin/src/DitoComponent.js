import Vue from 'vue'

import escape from './utils/escape'

let registry = []

let DitoComponent = Vue.extend({
  // Make sure that registered components are present in all DitoComponent.
  components: registry,

  beforeCreate() {
    // As a convention, when a DitoComponent instance receives a prop called
    // `props`, its fields are merged into the component's props. This is used
    // when DitoForm renders DitoComponents from the schema.
    let data = this.$options.propsData
    if (data) {
      let props = data.props
      if (props) {
        for (var key in props) {
          data[key] = props[key]
        }
      }
    }
  },

  methods: {
    getRouteRecord() {
      // Walks through the matched routes and all components of each route, to
      // find the route that is associated with this component, and returns it.
      for (let route of this.$route.matched) {
        let components = route.components
        for (let name in components) {
          if (components[name] === this.constructor) {
            return route
          }
        }
      }
      return null
    },

    getMeta() {
      let route = this.getRouteRecord()
      return route && route.meta || null
    },

    escape
  }
})

DitoComponent.register = function(type, options) {
  let props = options.props
  let ctor = DitoComponent.extend(Object.assign({}, options, {
    props: Array.isArray(props)
        ? ['props'].concat(props)
        : Object.assign({ props: { type: Object, required: false } }, props)
  }))
  registry[`dito-${type}`] = ctor
  return ctor
}

DitoComponent.get = function(type) {
  return registry[`dito-${type}`]
}

export default DitoComponent
