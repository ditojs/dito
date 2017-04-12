import BaseComponent from './BaseComponent'

const TypeComponent = BaseComponent.extend({
  computed: {
    value() {
      // In order to set up proper bindings between form components and member
      // items, we can define value as a computed property from data[name].
      // Passing data[name] as prop to the component wouldn't work, as the
      // binding needs to happen through a lookup on data.
      return this.data[this.name]
    }
  }
})

const types = BaseComponent.types

TypeComponent.register = function(type, options) {
  const name = `dito-${type}`
  types[type] = name
  const props = options && options.props
  return TypeComponent.component(name, Object.assign({}, options, {
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

TypeComponent.get = function(type) {
  return BaseComponent.components[types[type]]
}

export default TypeComponent
