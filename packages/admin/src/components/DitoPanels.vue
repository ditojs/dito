<template lang="pug">
.dito-panels(
  v-if="panels.length > 0"
)
  DitoPanel(
    v-for=`{
      schema,
      dataPath,
      componentPath,
      tabName,
      isTabSelected
    } in panels`
    :key="getPanelKey(dataPath, tabName)"
    :schema="schema"
    :dataPath="dataPath"
    :panelComponentPath="componentPath"
    :data="data"
    :store="getChildStore(schema.name)"
    :disabled="schema.disabled ?? disabled"
    :isTabSelected="isTabSelected"
  )
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoPanels', {
  props: {
    panels: { type: Array, default: null },
    data: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  },

  methods: {
    getPanelKey(dataPath, tabName) {
      // Allow separate tabs to use panels of the same name, by
      // prefixing their key with the tab name.
      return tabName ? `${tabName}_${dataPath}` : dataPath
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-panels {
  margin: $content-padding;
  margin-left: $form-spacing;
}
</style>
