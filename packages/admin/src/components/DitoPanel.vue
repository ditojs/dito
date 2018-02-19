<template lang="pug">
  ul.dito-panel(
    v-if="components"
  )
    li.dito-panel-bar(
      v-if="label !== undefined && !schema.compact"
    )
      dito-label(
        :dataPath="dataPath"
        :text="panelLabel"
      )
    li.dito-container(
      v-for="(compSchema, compDataPath) in components"
      v-show="getValue(compSchema, 'visible', true)"
      :style="getStyle(compSchema)"
      :key="compDataPath"
    )
      dito-label(
        v-if="compSchema.label !== false"
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
        :disabled="isDisabled(compSchema)"
        :class="{ \
          'dito-disabled': isDisabled(compSchema), \
          'dito-fill': hasFill(compSchema), \
          'dito-fixed': isFixed(compSchema), \
          'dito-has-errors': $errors.has(compDataPath) \
        }"
      )
      dito-errors(
        v-if="$errors.has(compDataPath)"
        :dataPath="compDataPath"
      )
</template>

<style lang="sass">
.dito
  .dito-panel
    display: flex
    flex-flow: row wrap
    position: relative
    align-items: baseline
    margin: (-$form-spacing) (-$form-spacing-half)
    &::after
      // Use a pseudo element to display a ruler with proper margins
      display: 'block'
      content: ''
      width: 100%
      padding-bottom: $form-margin
      border-bottom: $border-style
      // Add removed $form-spacing again to the ruler
      margin: 0 $form-spacing-half $form-margin
    .dito-container
      flex: 1 1 auto
      align-self: stretch
      box-sizing: border-box
      // Cannot use margin here as it needs to be part of box-sizing for
      // percentages in flex-basis to work.
      padding: $form-spacing $form-spacing-half
    .dito-panel-bar
      flex-basis: 100%
      padding: $form-spacing
      margin: 0 (-$form-spacing-half)
      .dito-label
        margin-bottom: 0
    &.dito-component.dito-fill
      // When nested, erase the .dito-component.dito-fill style from below again
      width: auto
  .dito-component.dito-fill
    display: block
    width: 100%
    &.dito-checkbox,
    &.dito-radio-button
      // WebKit doesn't like changed width on checkboxes and radios, override:
      display: inline-block
      width: auto
  .dito-list
    .dito-panel
      &::after
        // Hide the ruler in nested forms
        display: none
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isFunction } from '@ditojs/utils'

export default DitoComponent.component('dito-panel', {
  inject: ['$validator'],

  props: {
    tab: { type: String },
    label: { type: String },
    schema: { type: Object },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  },

  computed: {
    components() {
      // Compute a components list which has the dataPath baked into its keys
      // and adds the key as the name to each component, used for labels, etc.
      const {
        dataPath,
        // NOTE: schema can be null while multi-form lists load their data.
        schema = {}
      } = this
      const components = {}
      for (const [name, component] of Object.entries(schema.components || {})) {
        components[dataPath ? `${dataPath}/${name}` : name] = {
          name,
          ...component
        }
      }
      return components
    },

    panelLabel() {
      const label = this.getLabel(this.schema)
      return this.label ? `${label}: ${this.label}` : label
    }
  },

  methods: {
    getValue(schema, key, defaultValue) {
      const value = schema[key]
      return value === undefined
        ? defaultValue
        : isFunction(value)
          ? value(this.data)
          : value
    },

    isDisabled(schema) {
      return this.getValue(schema, 'disabled', false) || this.disabled
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
