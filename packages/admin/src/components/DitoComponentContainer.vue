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
      :nested="nested"
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
import { getTypeOptions, shouldOmitPadding } from '@/utils/schema'
import { parseFraction } from '@/utils/math'
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
    nested: { type: Boolean, default: true },
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
      return this.nested ? this.dataPath : null
    },

    componentWidth: getSchemaAccessor('width', {
      type: String,
      default({ component }) {
        return component.typeOptions.defaultWidth
      },
      get(width) {
        // Use 100% == 1.0 as default width when nothing is set:
        return width === undefined ? 1.0 : width
      }
    }),

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
    }),

    containerClass() {
      const { containerClass } = this.schema
      return {
        // Use the component name as its class, so the extended
        // dito-button-container automatically works too.
        [this.$options.name]: true,
        'dito-single': this.single,
        'dito-omit-padding': shouldOmitPadding(this.schema),
        ...(
          isString(containerClass)
            ? { [containerClass]: true }
            : containerClass
        )
      }
    },

    componentBasis() {
      const { componentWidth } = this
      const width = isString(componentWidth)
        ? componentWidth.match(/([^<>]+)/g)[0] // Remove '<' & '>'
        : componentWidth
      // 'auto' = no fitting:
      const basis = (
        width == null || width === 'auto' || width === 'fill' ? 'auto'
        : /%$/.test(width) ? parseFloat(width) // percentage
        : parseFraction(width) * 100 // fraction
      )
      return basis !== 'auto' ? `${basis}%` : basis
    },

    containerStyle() {
      // Interpret '>50%' as '50%, flex-grow: 1`
      const grow = (
        /^>/.test(this.componentWidth) ||
        this.componentWidth === 'fill'
      )
      // Interpret '<50%' as '50%, flex-shrink: 1`
      const shrink = /^</.test(this.componentWidth)
      return {
        flex: `${grow ? 1 : 0} ${shrink ? 1 : 0} ${this.componentBasis}`
      }
    },

    componentClass() {
      const auto = this.componentBasis === 'auto'
      return {
        'dito-single': this.single,
        'dito-disabled': this.componentDisabled,
        'dito-width-fill': !auto,
        'dito-width-auto': auto,
        'dito-has-errors': !!this.errors
      }
    }
  },

  methods: {
    onErrors(errors) {
      this.errors = errors
    }
  }
})
</script>
