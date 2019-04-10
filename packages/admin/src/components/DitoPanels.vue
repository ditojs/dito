<template lang="pug">
  .dito-panels
    dito-panel(
      v-for="{ schema, visible, key, dataPath } in panels"
      v-if="shouldRender(schema)"
      v-show="visible()"
      :key="key"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="getChildStore(schema.name)"
      :disabled="schema.disabled != null ? schema.disabled : disabled"
    )
</template>

<style lang="sass">
.dito
  .dito-panels
    margin-left: $content-padding
    max-width: $content-sidebar-width
    min-width: $content-sidebar-width * 3 / 4
</style>

<script>
import DitoComponent from '@/DitoComponent'

// @vue/component
export default DitoComponent.component('dito-panels', {
  props: {
    panels: { type: Array, default: null },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  }
})
</script>
