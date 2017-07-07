export default {
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
  }
}
