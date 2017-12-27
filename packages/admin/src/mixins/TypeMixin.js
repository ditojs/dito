export default {
  // Inherit the $validator from the parent.
  // See: https://github.com/logaretm/vee-validate/issues/468
  // NOTE: We can't do this in DitoMixin for all components, as it would
  // override the $validates: true` setting there.
  inject: ['$validator'],

  props: {
    schema: { type: Object, required: true },
    name: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: false }
  },

  // Register and unregister all type components on their parent forms for easy
  // lookup.
  created() {
    const form = this.formComponent
    if (form) {
      form.components[this.name] = this
    }
  },

  destroyed() {
    const form = this.formComponent
    if (form) {
      delete form.components[this.name]
    }
  },

  computed: {
    value: {
      get() {
        return this.data[this.schema.name]
      },
      set(value) {
        this.$set(this.data, this.schema.name, value)
      }
    },

    type() {
      return this.schema.type
    },

    label() {
      return this.getLabel(this.schema)
    },

    readonly() {
      return this.schema.readonly
    },

    placeholder() {
      return this.schema.placeholder
    },

    step() {
      return this.schema.step
    },

    min() {
      const { schema } = this
      return schema.range ? schema.range[0] : schema.min
    },

    max() {
      const { schema } = this
      return schema.range ? schema.range[1] : schema.max
    },

    required() {
      return !!this.schema.required
    },

    validations() {
      const rules = {
        required: this.required
      }
      if (this.min) {
        rules.min_value = this.min
      }
      if (this.max) {
        rules.max_value = this.max
      }
      if (this.step) {
        rules.decimal = `${this.step}`.split('.')[1].length
      }
      return { rules }
    }
  },

  methods: {
    addErrors(errors, focus) {
      for (const { message } of errors) {
        // Convert to the same sentence structure as vee-validate:
        const prefix = `The ${this.label} field`
        this.$errors.add(this.name,
          message.indexOf(prefix) === 0 ? message : `${prefix} ${message}.`)
      }
      if (focus) {
        this.focus()
      }
    },

    navigateToErrors(pointer, errors) {
      const navigate = this.navigateToComponent
      if (navigate) {
        navigate.call(this, pointer, (route, property) => {
          const { matched } = route
          const { meta } = matched[matched.length - 1]
          // Pass on the errors to the instance through the meta object,
          // see DitoForm.created()
          if (property) {
            meta.errors = {
              [property]: errors
            }
          }
        })
      } else {
        throw new Error(`Cannot show errors for field ${pointer}: ${errors}`)
      }
    },

    focus() {
      // Also focus this component's panel in case it's a tab.
      this.$parent.focus()
      const input = this.getElement('input')
      if (input) {
        this.$nextTick(() => input.focus())
      }
    }
  }
}
