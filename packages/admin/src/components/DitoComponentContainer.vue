<template lang="pug">
  // See `containerClass` for the assignment of the class-names to this div:
  div(
    v-if="shouldRender(schema)"
    v-show="isVisible(schema)"
    :class="containerClass"
    :style="containerStyle"
    :key="dataPath"
  )
    dito-label(
      v-if="label"
      :dataPath="dataPath"
      :text="label"
    )
    component.dito-component(
      :is="getTypeComponent(schema.type)"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled || isDisabled(schema)"
      :class="componentClass"
    )
    dito-errors(
      v-if="$errors.has(dataPath)"
      :dataPath="dataPath"
    )
</template>

<style lang="sass">
.dito
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
import { shouldRenderLabel, getContainerClass } from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-component-container', {
  inject: ['$validator'],

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
      return width == null || ['auto', 'fixed', 'fill'].includes(width) ? null
        : /%/.test(width) ? parseFloat(width) // percentage
        : width * 100 // fraction
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
      return {
        'flex-basis': this.percentage && `${this.percentage}%`,
        'flex-grow': ['fixed', 'auto'].includes(this.width) ? 0 : 1
      }
    },

    componentClass() {
      const { width } = this
      return {
        'dito-disabled': this.disabled || this.isDisabled(this.schema),
        'dito-fill': width === 'fill' || this.percentage > 0,
        'dito-fixed': width === 'fixed',
        'dito-auto': width === 'auto',
        'dito-has-errors': this.$errors.has(this.dataPath)
      }
    }
  }
})
</script>
