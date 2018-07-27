// DitoListCell needed to be split off from TypeList because of the need of
// its own `component` computed property to call `resolveTypeComponent()`.
// Direclty calling `resolveTypeComponent()` from the template was leading to
// infinite recursions and stack-overflows.

<template lang="pug">
  td(
    :class="cell.class"
    :style="cell.style"
  )
    // TODO: Implement inline components in cell mode!
    component(
      v-if="component"
      :is="component"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
    span(
      v-else
      v-html="renderCell(cell, data)"
    )
</template>

<script>
import DitoComponent from '@/DitoComponent'
import { escapeHtml } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-list-cell', {
  props: {
    cell: { type: Object, required: true },
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, default: false }
  },

  computed: {
    component() {
      return this.resolveTypeComponent(this.cell.component)
    }
  },

  methods: {
    renderCell(cell, item) {
      const { name, render } = cell
      const value = item[name]
      return render ? render(value, item) : escapeHtml(value)
    }
  }
})
</script>
