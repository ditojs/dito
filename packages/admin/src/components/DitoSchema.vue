<template lang="pug">
  .dito-schema
    .dito-schema-header(
      v-if="label || tabs || clipboard"
      :class="{ 'dito-schema-menu-header': menuHeader }"
    )
      .dito-label(
        v-if="label"
      ) {{ label }}
      dito-tabs(
        v-if="tabs"
        :tabs="tabs"
        :selectedTab="selectedTab"
      )
      dito-clipboard(
        v-if="clipboard"
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
$tab-height: $menu-font-size + 2 * $tab-padding-ver
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
  .dito-schema-header
    display: flex
    box-sizing: border-box
    // turn off pointer events in background so that DitoTrail keeps working.
    pointer-events: none
    justify-content: space-between
    > *
      pointer-events: auto
    .dito-tabs,
    .dito-clipboard
      display: flex
      align-self: flex-end
    .dito-clipboard
      .dito-button
        margin: 0 0 $tab-margin $tab-margin
    &.dito-schema-menu-header
      position: absolute
      height: $tab-height
      margin-top: -$tab-height
      padding: 0 $menu-padding-hor
      max-width: $content-width
      top: 0
      left: 0
      right: 0
      z-index: $menu-z-index
      > *
        font-size: $menu-font-size
      .dito-tabs a
        line-height: $menu-line-height
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
    generateLabels: { type: Boolean, default: true },
    menuHeader: { type: Boolean, default: false }
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
