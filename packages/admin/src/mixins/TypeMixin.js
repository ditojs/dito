export default {
  props: {
    name: { type: String, required: true },
    desc: { type: Object, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
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
    },

    required() {
      return !!this.desc.required
    },

    validations() {
      const rules = {}
      if (this.required) {
        rules.required = this.required
      }
      if (this.min) {
        rules.min_value = this.min
      }
      if (this.max) {
        rules.max_value = this.max
      }
      if (this.step) {
        const d = this.step.toString().split('.')[1].length
        rules.decimal = d
      }

      return { rules: rules }
    }
  }
}
