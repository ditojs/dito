import { h } from 'vue'

// A custom input, like lineto's components that edit values, e.g. its range
// slider. Custom components receive `DitoMixin` and `TypeMixin`, which provide
// `label` and `value`.
export default {
  render(this: { label: string; value: unknown }) {
    return h('input', {
      'aria-label': this.label,
      'value': this.value ?? '',
      'onInput': (event: Event) => {
        this.value = (event.target as HTMLInputElement).value
      }
    })
  }
}
