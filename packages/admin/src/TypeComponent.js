import BaseComponent from './BaseComponent'

const TypeComponent = BaseComponent.extend()

const types = BaseComponent.types

TypeComponent.register = function(type, options) {
  const name = `type-${type}`
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
