<template lang="pug">
.dito-panels(
  v-if="panels.length > 0"
)
  template(
    v-for="{ schema, dataPath, tabComponent } in panels"
  )
    DitoPanel(
      v-if="shouldRenderSchema(schema)"
      :key="getPanelKey(dataPath, tabComponent)"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="getChildStore(schema.name)"
      :disabled="schema.disabled != null ? schema.disabled : disabled"
      :panelTabComponent="tabComponent"
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoPanels', {
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

<style lang="scss">
@import '../styles/_imports';

.dito-panels {
  padding: $content-padding;
  padding-left: $form-spacing;
}
</style>
