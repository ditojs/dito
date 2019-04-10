<template lang="pug">
  component.dito-panel(
    :is="panelTag"
    v-show="visible"
    @submit.prevent
  )
    .dito-panel-title {{ getLabel(schema) }}
    dito-schema.dito-panel-schema(
      ref="schema"
      :schema="panelSchema"
      :dataPath="ownDataPath"
      :data="panelData"
      :meta="panelMeta"
      :store="store"
      :disabled="disabled"
      :hasOwnData="!!ownData"
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
        font-weight: normal
      .dito-components
        margin: 0 (-$form-spacing-half)
      .dito-component-container
        padding: $form-spacing-half
      .dito-buttons-container
        justify-content: flex-end
        padding-top: $form-spacing
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { getButtonSchemas } from '@/utils/schema'
import { getSchemaAccessor } from '@/utils/accessor'
import { isFunction } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-panel', {
  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
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

    panelData() {
      return this.ownData || this.data
    },

    panelSchema() {
      if (this.ownData) {
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
      return this.ownData ? 'form' : 'div'
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
      return this.ownData ? this.dataPath : this.schemaComponent.dataPath
    },

    visible: getSchemaAccessor('visible', {
      type: Boolean,
      default: true
    })
  },

  created() {
    // Register the panels so that other components can find them by their
    // data-path, e.g. TypeList for display of errors.
    this.registerComponent(this.dataPath, this)
    // NOTE: This is not the same as `schema.data` handling in DitoSchema,
    // where the data is added to the actual component.
    const { data } = this.schema
    if (data) {
      this.ownData = isFunction(data)
        ? data.call(this)
        : data
    }
  },

  destroyed() {
    this.registerComponent(this.dataPath, null)
  },

  methods: {
    showErrors(errors, focus) {
      this.$refs.schema.showErrors(errors, focus)
    },

    clearErrors() {
      this.$refs.schema.clearErrors()
    }
  }
})
</script>
