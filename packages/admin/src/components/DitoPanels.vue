<template lang="pug">
  .dito-panels
    dito-panel(
      v-for="{ schema, dataPath, tabComponent } in panels"
      v-if="shouldRender(schema)"
      :key="getPanelKey(dataPath, tabComponent)"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="getChildStore(schema.name)"
      :disabled="schema.disabled != null ? schema.disabled : disabled"
      :tabComponent="tabComponent"
    )
</template>

<style lang="sass">
.dito
  .dito-panels
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
  },

  methods: {
    getPanelKey(dataPath, tabComponent) {
      // Allow separate tabs to use panels of the same name, by
      // prefixing their key with the tab name.
      return tabComponent ? `${tabComponent.tab}_${dataPath}` : dataPath
    }
  }
})
</script>
