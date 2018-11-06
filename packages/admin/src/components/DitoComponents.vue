<template lang="pug">
  .dito-components(
    v-if="componentSchemas"
  )
    .dito-components-container.dito-schema-content
      .dito-component-container(
        v-for="(compSchema, compDataPath) in componentSchemas"
        v-if="shouldRender(compSchema)"
        v-show="isVisible(compSchema)"
        :class="getClass(compSchema)"
        :style="getStyle(compSchema)"
        :key="compDataPath"
      )
        dito-label(
          v-if="hasLabel(compSchema)"
          :dataPath="compDataPath"
          :text="getLabel(compSchema)"
        )
        component.dito-component(
          :is="getTypeComponent(compSchema.type)"
          :schema="compSchema"
          :dataPath="compDataPath"
          :data="data"
          :meta="meta"
          :store="getChildStore(compSchema.name)"
          :disabled="disabled || isDisabled(compSchema)"
          :class=`{
            'dito-disabled': disabled || isDisabled(compSchema),
            'dito-fill': hasFill(compSchema),
            'dito-fixed': isFixed(compSchema),
            'dito-has-errors': $errors.has(compDataPath)
          }`
        )
        dito-errors(
          v-if="$errors.has(compDataPath)"
          :dataPath="compDataPath"
        )
    dito-panels(
      v-if="panelSchemas"
      :panels="panelSchemas"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
</template>

<style lang="sass">
.dito
  .dito-components
    display: flex
    .dito-components-container,
    .dito-panels
      flex: auto
    .dito-components-container
      // Remove padding added by .dito-component-container below
      margin: (-$form-spacing) (-$form-spacing-half)
      // Add removed horizontal margin again to max-width:
      max-width: $content-width + 2 * $form-spacing-half
      display: flex
      flex-flow: row wrap
      position: relative
      align-items: baseline
    .dito-component-container
      flex: 1 1 auto
      align-self: stretch
      box-sizing: border-box
      // Cannot use margin here as it needs to be part of box-sizing for
      // percentages in flex-basis to work.
      padding: $form-spacing $form-spacing-half
      &.no-padding,
      &:empty,
        padding: 0
  // NOTE: This is not nested inside .dito-component-container so that other
  // type components can override `.dito-fill` behavior (filter precedence).
  .dito-component.dito-fill
    display: block
    width: 100%
    &.dito-checkbox,
    &.dito-radio-button
      // WebKit doesn't like changed width on checkboxes and radios, override:
      display: inline-block
      width: auto
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { appendDataPath } from '@/utils/data'
import {
  shouldRenderLabel, getContainerClass, getPanelSchema
} from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-components', {
  inject: ['$validator'],

  props: {
    tab: { type: String, default: null },
    schema: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: true }
  },

  computed: {
    componentSchemas() {
      // Compute a components list which has the dataPath baked into its keys
      // and adds the key as the name to each component, used for labels, etc.
      // NOTE: schema can be null while multi-form lists load their data,
      // because only the avialble data will determine the type of form.
      const { dataPath, schema = {} } = this
      // When editing primitive values through a form, do not append 'value' to
      // the component's dataPath so it can be mapped to from validation errors.
      const wrapPrimitives = this.sourceSchema?.wrapPrimitives
      return Object.entries(schema.components || {}).reduce(
        (schemas, [name, component]) => {
          const path = wrapPrimitives
            ? dataPath
            : appendDataPath(dataPath, name)
          schemas[path] = {
            name,
            ...component
          }
          return schemas
        },
        {}
      )
    },

    panelSchemas() {
      const panels = {}
      for (const [dataPath, schema] of Object.entries(this.componentSchemas)) {
        const panel = getPanelSchema(schema, dataPath, this.schemaComponent)
        if (panel) {
          const path = panel.name
            ? appendDataPath(dataPath, panel.name)
            : dataPath
          panels[path] = panel
        }
      }
      return Object.keys(panels).length ? panels : null
    }
  },

  methods: {
    hasLabel(schema) {
      return (
        schema.label !== false &&
        shouldRenderLabel(schema) && (
          schema.label ||
          this.generateLabels
        )
      )
    },

    hasFill(schema) {
      return this.getPercentage(schema) > 0 || schema.width === 'fill'
    },

    isFixed(schema) {
      return schema.width === 'fixed'
    },

    getPercentage(schema) {
      const { width } = schema
      // 'auto' = no fitting:
      return ['auto', 'fixed', 'fill'].includes(width) ? null
        : !width ? 100 // default = 100%
        : /%/.test(width) ? parseFloat(width) // percentage
        : width * 100 // fraction
    },

    getClass(schema) {
      return getContainerClass(schema)
    },

    getStyle(schema) {
      const percentage = this.getPercentage(schema)
      const fixed = this.isFixed(schema)
      return {
        'flex-basis': percentage && `${percentage}%`,
        'flex-grow': fixed && 0
      }
    },

    focus() {
      if (this.tab) {
        this.$router.push({ hash: this.tab })
      }
    }
  }
})
</script>
