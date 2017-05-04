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
      const desc = this.desc
      return desc.required ? desc.required : true
    },

    validations() {
      const desc = this.desc
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
      if (desc.type === 'text') {
        rules.alpha_num = true
      }

      return { rules: rules }
    }
  }
}
