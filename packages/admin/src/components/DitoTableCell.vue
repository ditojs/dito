<template lang="pug">
td(
  :class="cell.class"
  :style="cell.style"
)
  //- TODO: Implement inlined components in cell mode!
  component(
    v-if="cell.component"
    :is="cell.component"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :nested="nested"
    :disabled="disabled"
  )
  span(
    v-else
    v-html="renderCell(data)"
  )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import ContextMixin from '../mixins/ContextMixin.js'
import { appendDataPath } from '../utils/data.js'
import { escapeHtml } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoTableCell', {
  mixins: [ContextMixin],

  props: {
    cell: { type: Object, required: true },
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false }
  },

  methods: {
    renderCell(item) {
      const { name, render } = this.cell
      const value = item[name]
      return render
        ? render.call(
            this,
            new DitoContext(this, {
              name,
              value,
              data: item,
              dataPath: appendDataPath(this.dataPath, name)
            })
          )
        : escapeHtml(value)
    }
  }
})
</script>
