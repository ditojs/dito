<template lang="pug">
  component.dito-panel(
    :is="panelTag"
    :style="panelStyle"
    @submit.prevent
  )
    .dito-panel-title {{ getLabel(schema) }}
    dito-schema.dito-panel-schema(
      :schema="panelSchema"
      :dataPath="panelDataPath"
      :data="panelData"
      :meta="panelMeta"
      :store="store"
      :disabled="disabled"
    )
      dito-buttons(
        slot="buttons"
        :buttons="buttonSchemas"
        :dataPath="panelDataPath"
        :data="panelData"
        :meta="panelMeta"
        :store="store"
        :disabled="disabled"
      )
</template>

<style lang="sass">
.dito
  .dito-panel
    position: absolute
    left: 0
    right: 0
    z-index: 1
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
import { isFunction } from '@ditojs/utils'

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

  data() {
    return {
      panelData: this.data
    }
  },

  computed: {
    buttonSchemas() {
      return getButtonSchemas(this.schema.buttons)
    },

    hasOwnData() {
      return this.panelData !== this.data
    },

    target() {
      return this.schema.target || this.dataPath
    },

    panelSchema() {
      if (this.hasOwnData) {
        return this.schema
      } else {
        // Remove `data` from the schema, so that DitoSchema isn't using it to
        // produce its own data. See $filters panel for more details on data.
        const { data, ...schema } = this.schema
        return schema
      }
    },

    panelDataPath() {
      // If the panel provides its own data, then it needs to prefix all
      // components  with its data-path, but if it shares data with the schema
      // component, then it should share the data-path name space too.
      return this.hasOwnData ? this.dataPath : ''
    },

    panelTag() {
      // Panels that provide their own data need their own form.
      return this.hasOwnData ? 'form' : 'div'
    },

    panelMeta() {
      return {
        ...this.meta,
        // Additional parameters to be passed to all events:
        params: { panelComponent: this }
      }
    },

    panelStyle() {
      const { top } = this
      return {
        visibility: top != null ? 'visible' : 'hidden',
        top: top != null ? `${top}px` : null
      }
    }
  },

  created() {
    // NOTE: This is not the same as `schema.data` handling in DitoSchema,
    // where the data is added to the actual component.
    const { data } = this.schema
    if (data) {
      this.panelData = isFunction(data)
        ? data.call(this)
        : data
    }
  }
})
</script>
