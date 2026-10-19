import { defineComponent, h } from 'vue'
import { DitoSchemaField, DitoPane } from '@ditojs/admin'

// A layout that places a field next to a group of fields in a row:
export default defineComponent({
  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true }
  },

  render() {
    return [
      h(DitoSchemaField, { name: 'title' }),
      h(DitoPane, { names: ['first', 'last'] })
    ]
  }
})
