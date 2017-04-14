import BaseComponent from './BaseComponent'

const TypeComponent = BaseComponent.extend({
  props: {
    name: { type: String, required: true },
    desc: { type: Object, required: true },
    data: { type: Object, required: true },
    user: { type: Object, required: true },
    root: { type: Boolean, required: true },
    disabled: { type: Boolean, required: false }
  },
  computed: {
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
