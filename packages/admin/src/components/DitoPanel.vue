<template lang="pug">
  // Only show panels in tabs when the tabs are also visible.
  component.dito-panel(
    :is="panelTag"
    v-show="visible && (!tabComponent || tabComponent.visible)"
    @submit.prevent
  )
    label.dito-panel-title {{ getLabel(schema) }}
    dito-schema.dito-panel-schema(
      :schema="panelSchema"
      :dataPath="ownDataPath"
      :data="panelData"
      :meta="panelMeta"
      :store="store"
      :disabled="disabled"
      :hasOwnData="hasOwnData"
    )
      dito-buttons(
        slot="buttons"
        :buttons="buttonSchemas"
        :dataPath="ownDataPath"
        :data="panelData"
        :meta="panelMeta"
        :store="store"
        :disabled="disabled"
      )
</template>

<style lang="sass">
  .dito-panel
    margin-bottom: $content-padding
    .dito-panel-title
      display: block
      box-sizing: border-box
      padding: $input-padding
      background: $button-color
      border: $border-style
      border-top-left-radius: $border-radius
      border-top-right-radius: $border-radius
    .dito-panel-schema
      font-size: $font-size-small
      background: $content-color-background
      border: $border-style
      border-top: 0
      border-bottom-left-radius: $border-radius
      border-bottom-right-radius: $border-radius
      > .dito-schema-content
        padding: $form-spacing-half $form-spacing
        > .dito-buttons
          --button-margin: #{$form-spacing}
          padding: $form-spacing-half 0
      .dito-object
        border: 0
        padding: 0
      .dito-label
        margin: 0
        label
          font-weight: normal
      .dito-components
        margin: 0 (-$form-spacing-half)
      .dito-component-container
        padding: $form-spacing-half
</style>

<script>
import DitoComponent from '@/DitoComponent'
import ValidatorMixin from '@/mixins/ValidatorMixin'
import { getButtonSchemas } from '@/utils/schema'
import { getSchemaAccessor } from '@/utils/accessor'
import { isFunction } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-panel', {
  mixins: [ValidatorMixin],
  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    tabComponent: { type: DitoComponent, default: null }
  },

  data() {
    return {
      ownData: null
    }
  },

  computed: {
    buttonSchemas() {
      return getButtonSchemas(this.schema.buttons)
    },

    target() {
      return this.schema.target || this.dataPath
    },

    hasOwnData() {
      return !!this.ownData
    },

    panelData() {
      return this.ownData || this.data
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

    ownDataPath() {
      // If the panel provides its own data, then it needs to prefix all
      // components with its data-path, but if it shares data with the schema
      // component, then it should share the data-path name space too.
      return this.hasOwnData ? this.dataPath : this.schemaComponent.dataPath
    },

    visible: getSchemaAccessor('visible', {
      type: Boolean,
      default: true
    })
  },

  created() {
    this._register(true)
    // NOTE: This is not the same as `schema.data` handling in DitoSchema,
    // where the data is added to the actual component.
    const { data } = this.schema
    if (data) {
      this.ownData = isFunction(data)
        ? data.call(this)
        : data
    }
  },

  beforeDestroy() {
    this._register(false)
  },

  methods: {
    _register(add) {
      // Register the panels so that other components can find them by their
      // data-path, e.g. in TypeList.onFilterErrors()
      this.schemaComponent._registerPanel(this, add)
    }
  }
})
</script>
