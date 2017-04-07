import BaseComponent from './BaseComponent'

let types = []

let TypeComponent = BaseComponent.extend({
  methods: {
    typeToComponent(type) {
      return types[type]
    }
  }
})

TypeComponent.register = function(type, options) {
  let name = `dito-${type}`
  types[type] = name
  let props = options && options.props
  return this.component(name, Object.assign({}, options, {
    props: Array.isArray(props)
        ? ['name', 'desc', 'data', 'loading'].concat(props)
        : Object.assign({
          name: { type: String, required: true },
          desc: { type: Object, required: true },
          data: { type: Object, required: true },
          loading: { type: Boolean, required: false }
        }, props)
  }))
}

TypeComponent.get = function(type) {
  return TypeComponent.options.components[types[type]]
}

export default TypeComponent
