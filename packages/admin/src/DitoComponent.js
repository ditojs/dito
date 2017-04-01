import Vue from 'vue'

function capitalize(text) {
  return text[0].toUpperCase() + text.slice(1)
}

function toComponentName(type) {
  return 'Dito' + capitalize(type)
}

let registry = []

let DitoComponent = Vue.extend({
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
    getRoute() {
      let matched = this.$route.matched
      for (let route of matched) {
        if (route.components.default === this.constructor) {
          return route
        }
      }
      return null
    },

    getMeta() {
      let route = this.getRoute()
      return route && route.meta || null
    },

    log(...args) {
      console.log(...args)
    },

    toComponentName
  }
})

DitoComponent.register = function(type, options) {
  let name = toComponentName(type)
  let props = options.props
  let ctor = DitoComponent.extend(Object.assign({}, options, {
    name: name,
    props: Array.isArray(props)
        ? ['props'].concat(props)
        : Object.assign({ props: { type: Object, required: false } }, props)
  }))
  registry[name] = ctor
  return ctor
}

DitoComponent.get = function(type) {
  return registry[toComponentName(type)]
}

DitoComponent.registry = registry

export default DitoComponent
