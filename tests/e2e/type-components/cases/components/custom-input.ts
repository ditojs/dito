import { defineComponent, h } from 'vue'

// A custom input, like components that edit values, e.g. sliders. Custom
// components receive the `schema`, its `context` and the value as
// `modelValue`, and emit `update:modelValue` and `change`. The label of the
// container labels their root element, which gets the id of the component.
export default defineComponent({
  emits: ['update:modelValue', 'change'],

  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true },
    modelValue: { type: String, default: null }
  },

  render() {
    return h('input', {
      value: this.modelValue ?? '',
      onInput: (event: Event) => {
        const { value } = event.target as HTMLInputElement
        this.$emit('update:modelValue', value)
      },
      onChange: () => this.$emit('change')
    })
  }
})
