<template lang="pug">
  // See `containerClass` for the assignment of the class-names to this div:
  div(
    v-show="componentVisible"
    :class="containerClass"
    :style="containerStyle"
  )
    dito-label(
      v-if="label"
      :dataPath="dataPath"
      :text="label"
      :class="componentClass"
    )
    component.dito-component(
      :is="getTypeComponent(schema.type)"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="componentDisabled"
      :class="componentClass"
    )
    dito-errors(
      :errors="errors"
    )
</template>

<style lang="sass">
.dito
  .dito-component-container
    align-self: stretch
    box-sizing: border-box
    // To prevent list tables from blowing out of their flex box containers.
    max-width: 100%
    // Cannot use margin here as it needs to be part of box-sizing for
    // percentages in flex-basis to work.
    padding: $form-spacing $form-spacing-half
    &.no-padding,
    &:empty,
      padding: 0
  // NOTE: This is not nested inside .dito-component-container so that other
  // type components can override `.dito-width-fill` class (filter precedence).
  .dito-component.dito-width-fill
    width: 100%
    &.dito-checkbox,
    &.dito-radio-button
      // WebKit doesn't like changed width on checkboxes and radios, override:
      display: inline-block
      width: auto
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { getSchemaAccessor } from '@/utils/accessor'
import {
  shouldRenderLabel, getContainerClass, getTypeOptions
} from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-component-container', {
  props: {
    schema: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: true }
  },

  computed: {
    label() {
      const { schema } = this
      const hasLabel = (
        schema.label !== false &&
        shouldRenderLabel(schema) && (
          schema.label ||
          this.generateLabels
        )
      )
      return hasLabel ? this.getLabel(schema) : null
    },

    width() {
      // Use 100% == 1.0 as default width when nothing is set:
      return this.schema.width ?? 1.0
    },

    percentage() {
      const { width } = this
      // 'auto' = no fitting:
      return width == null || ['auto', 'fill'].includes(width) ? null
        : /%/.test(width) ? parseFloat(width) // percentage
        : width * 100 // fraction
    },

    errors() {
      return this.schemaComponent.getErrors(this.dataPath)
    },

    containerClass() {
      return [
        // Use the component name as its class, so the extended
        // dito-button-container automatically works too.
        this.$options.name,
        getContainerClass(this.schema)
      ]
    },

    containerStyle() {
      const basis = this.percentage && `${this.percentage}%`
      const grow = (
        // TODO: Switch back to `width === 'auto' ? 0 : 1`
        // if `preventFlexGrowth` is never used.
        this.width === 'fill' ||
        this.width !== 'auto' && !getTypeOptions(this.schema)?.preventFlexGrowth
      ) ? 1 : 0
      return {
        'flex-basis': basis,
        'flex-grow': grow
      }
    },

    componentClass() {
      const { width } = this
      return {
        'dito-disabled': this.componentDisabled,
        'dito-width-fill': width === 'fill' || this.percentage > 0,
        'dito-width-auto': width === 'auto',
        'dito-has-errors': !!this.errors
      }
    },

    componentVisible: getSchemaAccessor('visible', {
      type: Boolean,
      default: true
    }),

    componentDisabled: getSchemaAccessor('disabled', {
      type: Boolean,
      default: false,
      get(disabled) {
        return disabled || this.disabled
      }
    })
  }
})
</script>
