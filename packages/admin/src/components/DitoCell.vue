// DitoListCell needed to be split off from TypeList because of the need of
// its own `component` computed property to call `resolveTypeComponent()`.
// Direclty calling `resolveTypeComponent()` from the template was leading to
// infinite recursions and stack-overflows.

<template lang="pug">
  td(
    :class="column.class"
    :style="column.style"
  )
    // TODO: Implement inline components in column mode!
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
      v-html="renderCell(column, data)"
    )
</template>

<style lang="sass">
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { escapeHtml } from '@ditojs/utils'

export default DitoComponent.component('dito-cell', {
  props: {
    column: { type: Object, required: true },
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: false }
  },

  computed: {
    component() {
      return this.resolveTypeComponent(this.column.component)
    }
  },

  methods: {
    renderCell(column, item) {
      const { name, render } = column
      const value = item[name]
      return render ? render(value, item) : escapeHtml(value)
    }
  }
})
</script>
