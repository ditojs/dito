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
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import { appendDataPath } from '../utils/data.js'
import { escapeHtml } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoTableCell', {
  props: {
    // The schema of the cell, e.g. a column of a list or a property of a tree
    // item, whose `name` is the key of its value in `data`.
    cell: { type: Object, required: true },
    // The schema of the list or tree that holds the item.
    schema: { type: Object, required: true },
    // The data path and data of the item, see `cellContext`.
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    store: { type: Object, required: true },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false }
  },

  computed: {
    cellContext() {
      const {
        cell: { name },
        data
      } = this
      return new DitoContext(this, {
        name,
        value: data[name],
        data,
        dataPath: appendDataPath(this.dataPath, name)
      })
    },

    cellHtml() {
      const { name, render } = this.cell
      return render ? render(this.cellContext) : escapeHtml(this.data[name])
    }
  }
})
</script>
