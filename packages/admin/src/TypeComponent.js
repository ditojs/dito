import BaseComponent from './BaseComponent'

const TypeComponent = BaseComponent.extend({
  props: {
    name: { type: String, required: true },
    desc: { type: Object, required: true },
    data: { type: Object, required: true },
    disabled: { type: Boolean, required: false }
  },
  computed: {
    value() {
      // In order to set up proper bindings between form components and member
      // items, we can define value as a computed property from data[name].
      // Passing data[name] as prop to the component wouldn't work, as the
      // binding needs to happen through a lookup on data.
      return this.data[this.name]
    },

    readonly() {
      return this.desc.readonly
    },

    placeholder() {
      return this.desc.placeholder
    },

    step() {
      return this.desc.step
    },

    min() {
      const desc = this.desc
      return desc.range ? desc.range[0] : desc.min
    },

    max() {
      const desc = this.desc
      return desc.range ? desc.range[1] : desc.max
    }
  }
})

const types = BaseComponent.types

TypeComponent.register = function(type, options) {
  const name = `dito-${type}`
  types[type] = name
  const defaultProps = TypeComponent.options.props
  const props = options && options.props
  return TypeComponent.component(name, Object.assign({}, options, {
    props: Array.isArray(props)
        ? Object.keys(defaultProps).concat(props)
        : Object.assign(defaultProps, props)
  }))
}

TypeComponent.get = function(type) {
  return BaseComponent.components[types[type]]
}

export default TypeComponent
