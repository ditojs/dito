<template lang="pug">
  component.dito-panel(
    :is="panelTag"
    :style="panelStyle"
    @submit.prevent
  )
    .dito-panel-title {{ getLabel(schema) }}
    dito-schema.dito-panel-schema(
      :schema="schema"
      :dataPath="panelDataPath"
      :data="panelData"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
      dito-buttons(
        slot="buttons"
        :buttons="buttonSchemas"
        :dataPath="panelDataPath"
        :data="panelData"
        :meta="meta"
        :store="store"
        :disabled="disabled"
      )
</template>

<style lang="sass">
.dito
  .dito-panel
    padding-bottom: $content-padding
    .dito-panel-title
      box-sizing: border-box
      height: 2em
      line-height: 2em
      padding: 0 $form-spacing
      background: $button-color
      border-top-left-radius: $border-radius
      border-top-right-radius: $border-radius
    .dito-panel-schema
      font-size: 11px
      margin-top: 1px
      background: $table-color-background
      border-bottom-left-radius: $border-radius
      border-bottom-right-radius: $border-radius
      padding: $form-spacing
      .dito-table td
        padding: 0
      .dito-label
        margin: 0
      .dito-components-container
        margin: 0 (-$form-spacing-half)
      .dito-component-container
        padding: $form-spacing-half
      .dito-buttons
        text-align: right
        padding: $form-spacing 0 0
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { getButtonSchemas } from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-panel', {
  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    top: { type: Number, default: null }
  },

  computed: {
    buttonSchemas() {
      return getButtonSchemas(this.schema.buttons)
    },

    panelTarget() {
      return this.schema.target || this.dataPath
    },

    panelData() {
      return this.schema.data ? this.schema.data() : this.data
    },

    panelDataPath() {
      // If the panel shares data with the schema, then it doesn't need to
      // prefix its own dataPath
      return this.schema.data ? this.dataPath : ''
    },

    panelTag() {
      // Panels that provide their own data need their own form
      return this.schema.data ? 'form' : 'div'
    },

    panelStyle() {
      const { top } = this
      return {
        visibility: top != null ? 'visible' : 'hidden',
        top: top != null ? `${top}px` : null
      }
    }
  }
})
</script>
