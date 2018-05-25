<template lang="pug">
  .dito-schema
    dito-schema-header(
      v-if="label || tabs || clipboard"
      :label="label"
      :tabs="tabs"
      :selectedTab="selectedTab"
      :clipboard="clipboard"
    )
    dito-components.dito-tab-components(
      v-for="(tabSchema, key) in tabs"
      v-show="selectedTab === key"
      :key="key"
      :tab="key"
      :schema="tabSchema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
      :generateLabels="generateLabels"
    )
    dito-components.dito-main-components(
      v-if="schema.components"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
      :generateLabels="generateLabels"
    )
    slot(name="buttons")
</template>

<style lang="sass">
.dito
  .dito-schema
    padding: $content-padding
    max-width: $content-width
    box-sizing: border-box
    // Display a ruler between tabbed components and towards the .dito-buttons
    .dito-tab-components + .dito-main-components,
    .dito-components + .dito-buttons
      &::before
        // Use a pseudo element to display a ruler with proper margins
        display: block
        content: ''
        width: 100%
        padding-top: $content-padding
        border-bottom: $border-style
        // Add removed $form-spacing again to the ruler
        margin: $form-spacing-half
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-schema', {
  props: {
    schema: { type: Object },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    label: { type: String, required: false },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: true }
  },

  computed: {
    tabs() {
      return this.schema?.tabs
    },

    selectedTab() {
      const { hash } = this.$route
      return hash?.substring(1) || this.tabs && Object.keys(this.tabs)[0] || ''
    },

    clipboard() {
      return this.schema?.clipboard
    }
  }
})
</script>
