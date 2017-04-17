export default {
  props: {
    name: { type: String, required: true },
    desc: { type: Object, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
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
}
