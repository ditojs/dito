<template lang="pug">
  .dito-panel(:style="style")
    .dito-panel-title {{ getLabel(schema) }}
    dito-schema.dito-panel-schema(
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
      dito-buttons(
        slot="buttons"
        :buttons="buttons"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :disabled="disabled"
      )
</template>

<style lang="sass">
.dito
  .dito-panel
    padding-top: $form-spacing
    padding-bottom: $content-padding - $form-spacing
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
    buttons() {
      return this.getButtonSchemas(this.schema.buttons)
    },

    style() {
      const { top } = this
      return {
        visibility: top != null ? 'visible' : 'hidden',
        top: top != null ? `${top}px` : null
      }
    }
  }
})
</script>
