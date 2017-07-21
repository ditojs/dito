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

  created() {
    // Register all type components on the form they belong to, for easy lookup.
    let form = this.formComponent
    if (form) {
      form.components[this.name] = this
    }
  },

  computed: {
    value: {
      get() {
        return this.data[this.name]
      },
      set(value) {
        this.data[this.name] = value
      }
    },

    type() {
      return this.schema.type
    },

    label() {
      return this.renderLabel(this.schema, this.name)
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
      const schema = this.schema
      return schema.range ? schema.range[0] : schema.min
    },

    max() {
      const schema = this.schema
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
    addErrors(errors) {
      for (let error of errors) {
        // Convert to the same sentence structure as vee-validate:
        const prefix = `The ${this.label} field`
        this.errors.add(this.name,
          error.indexOf(prefix) === 0 ? error : `${prefix} ${error}.`)
      }
    },

    showErrors(path, errors) {
      if (path.length > 1) {
        const navigate = this.navigateToComponent
        if (navigate) {
          navigate.call(this, path, route => {
            // Pass on the errors to the instance through the meta object.
            // See DitoForm.created()
            route.matched[route.matched.length - 1].meta.errors = {
              [path[path.length - 1]]: errors
            }
          })
        } else {
          throw new Error(
            `Cannot show errors for field ${path.join('/')}: ${errors}`)
        }
      } else {
        this.addErrors(errors)
      }
    },

    focus() {
      const input = this.getElement('input')
      if (input) {
        input.focus()
      }
    }
  }
}
