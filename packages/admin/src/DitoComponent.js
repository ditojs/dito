import Vue from 'vue'
import escape from './utils/escape'

let components = []
let types = []

let DitoComponent = Vue.extend({
  // Make sure that registered components are present in all DitoComponent.
  components: components,

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
    typeToComponent(type) {
      return types[type]
    },

    request(method, path, callback) {
      let request = this.$meta.api.request
      // TODO: Shall we fall back to axios locally imported, if no request
      // method is defined?
      return request && request(method, path, callback)
    },

    escape
  },

  computed: {
    $meta() {
      // Walks through the matched routes and all components of each route, to
      // find the route that is associated with this component, and returns it.
      // NOTE: This needs to be a computed property so that a change in $route
      // will trigger a recalculated $meta on reused router components.
      for (let route of this.$route.matched) {
        let components = route.components
        for (let name in components) {
          if (components[name] === this.constructor) {
            return route.meta
          }
        }
      }
      return null
    }
  }
})

DitoComponent.component = function(name, options) {
  let ctor = DitoComponent.extend(Object.assign({
    name: name
  }, options))
  components[name] = ctor
  return ctor
}

DitoComponent.type = function(type, options) {
  let name = `dito-${type}`
  types[type] = name
  let props = options.props
  return DitoComponent.component(name, Object.assign({}, options, {
    props: Array.isArray(props)
        ? ['props'].concat(props)
        : Object.assign({ props: { type: Object, required: false } }, props)
  }))
}

DitoComponent.get = function(type) {
  return components[types[type]]
}

export default DitoComponent
