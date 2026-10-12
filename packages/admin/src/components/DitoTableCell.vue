<template lang="pug">
td(
  :class="cell.class"
  :style="cell.style"
)
  //- TODO: Implement inlined components in cell mode!
  component(
    v-if="cell.component"
    :is="cell.component"
    :schema="cell"
    :context="cellContext"
    :modelValue="data[cell.name]"
  )
  span(
    v-else
    v-html="cellHtml"
  )
</template>

<script>
import { computed } from 'vue'
import { escapeHtml } from '@ditojs/utils'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { appendDataPath } from '../utils/data.js'

export default {
  name: 'DitoTableCell',

  props: {
    // A column or tree property, whose `name` is the key of its value:
    cell: { type: Object, required: true },
    // The list or tree that holds the item:
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    store: { type: Object, required: true },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false }
  },

  setup(props) {
    const { createContext } = useSchemaContext(props)
    const cellContext = computed(() => {
      const { name } = props.cell
      return createContext({
        name,
        value: props.data[name],
        dataPath: appendDataPath(props.dataPath, name),
        nested: true
      })
    })

    return {
      cellContext,
      cellHtml: computed(() => {
        const { name, render } = props.cell
        return render
          ? render(cellContext.value)
          : escapeHtml(props.data[name])
      })
    }
  }
}
</script>
