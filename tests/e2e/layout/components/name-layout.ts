import { defineComponent, h } from 'vue'
import { DitoField, DitoPane } from '@ditojs/admin'

// A layout that places a field next to a group of fields in a row:
export default defineComponent({
  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true }
  },

  render() {
    return [
      h(DitoField, { name: 'title' }),
      h(DitoPane, { names: ['first', 'last'] })
    ]
  }
})
