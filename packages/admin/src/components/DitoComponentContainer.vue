<template lang="pug">
  // See `containerClass` for the assignment of the class-names to this div:
  div(
    v-show="componentVisible"
    :class="containerClass"
    :style="containerStyle"
  )
    dito-label(
      v-if="label"
      :label="label"
      :dataPath="labelDataPath"
      :class="componentClass"
    )
    component.dito-component(
      :is="getTypeComponent(schema.type)"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :single="single"
      :disabled="componentDisabled"
      :class="componentClass"
      @errors="onErrors"
    )
    dito-errors(
      :errors="errors"
    )
</template>

<style lang="sass">
  .dito-component-container
    // Needed for better vertical alignment:
    align-self: stretch
    box-sizing: border-box
    // To prevent list tables from blowing out of their flex box containers.
    max-width: 100%
    // Cannot use margin here as it needs to be part of box-sizing for
    // percentages in flex-basis to work.
    padding: $form-spacing $form-spacing-half
    &:empty
      padding: 0
    &.dito-omit-padding
      padding: 0
      > .dito-label
        margin: $form-spacing $form-spacing-half 0
    &.dito-single
      height: 100% // So that list buttons can be sticky at the bottom
  // NOTE: This is not nested inside .dito-component-container so that other
  // type components can override `.dito-width-fill` class (filter precedence).
  .dito-component
    &.dito-width-fill
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
import { getTypeOptions } from '@/utils/schema'
import { isString } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-component-container', {
  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, default: '' },
    data: { type: [Object, Array], required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    single: { type: Boolean, default: false },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: true }
  },

  data() {
    return {
      errors: null
    }
  },

  computed: {
    typeOptions() {
      return getTypeOptions(this.schema) || {}
    },

    hasLabel() {
      const { schema } = this
      const { label } = schema
      return (
        label !== false &&
        (!!label || this.typeOptions.generateLabel && this.generateLabels)
      )
    },

    label() {
      return this.hasLabel ? this.getLabel(this.schema) : null
    },

    labelDataPath() {
      // Unnested types don't have a dataPath for themselves, don't use it:
      return this.typeOptions.unnested ? null : this.dataPath
    },

    width() {
      const width = (
        this.schema.width ??
        this.typeOptions.defaultWidth
      )
      // Use 100% == 1.0 as default width when nothing is set:
      return width === undefined ? 1.0 : width
    },

    percentage() {
      const { width } = this
      // 'auto' = no fitting:
      return width == null || ['auto', 'fill'].includes(width) ? null
        : /%/.test(width) ? parseFloat(width) // percentage
        : width * 100 // fraction
    },

    containerClass() {
      const { containerClass } = this.schema
      return {
        // Use the component name as its class, so the extended
        // dito-button-container automatically works too.
        [this.$options.name]: true,
        'dito-single': this.single,
        'dito-omit-padding': (
          this.schema.omitPadding ||
          getTypeOptions(this.schema)?.omitPadding?.(this.schema)
        ),
        ...(
          isString(containerClass)
            ? { [containerClass]: true }
            : containerClass
        )
      }
    },

    containerStyle() {
      const basis = this.percentage && `${this.percentage}%`
      const grow = (
        this.width === 'fill' ||
        this.width !== 'auto' && !getTypeOptions(this.schema)?.omitFlexGrow
      ) ? 1 : 0
      return {
        'flex-basis': basis,
        'flex-grow': grow
      }
    },

    componentClass() {
      const { width } = this
      return {
        'dito-single': this.single,
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
  },

  methods: {
    onErrors(errors) {
      this.errors = errors
    }
  }
})
</script>
