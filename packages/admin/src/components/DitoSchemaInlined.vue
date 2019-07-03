<template lang="pug">
  dito-schema.dito-schema-inlined(
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :label="compact ? null: label"
    :disabled="disabled"
    :collapsed="collapsed"
    :collapsible="collapsible"
    :class="{ 'dito-schema-compact': compact }"
  )
</template>

<style lang="sass">
  .dito-schema-inlined
    > .dito-schema-content
      padding: 0
    .dito-schema-header
      // Change spacing so that .dito-label covers the full .dito-schema-header
      margin: -$form-spacing
      .dito-label
        // Add removed $form-spacing again, plus $form-spacing-half vertically.
        padding: ($form-spacing + $form-spacing-half) $form-spacing
      & +.dito-components
        padding-top: $form-spacing-half
        // Needed for transition-height in DitoSchema:
        min-height: $form-spacing-half
</style>

<script>
import DitoComponent from '@/DitoComponent'

// @vue/component
export default DitoComponent.component('dito-schema-inlined', {
  props: {
    schema: { type: Object, default: null },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    label: { type: String, default: null },
    disabled: { type: Boolean, required: true },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false }
  },

  computed: {
    compact() {
      return this.schema.compact
    },

    inlined() {
      return true
    }
  }
})
</script>
