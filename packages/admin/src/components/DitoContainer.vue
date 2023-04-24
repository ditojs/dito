<template lang="pug">
.dito-container(
  v-show="componentVisible"
  :class="containerClass"
  :style="containerStyle"
)
  DitoLabel(
    v-if="hasLabel"
    :label="label"
    :dataPath="labelDataPath"
    :class="componentClass"
  )
  component.dito-component(
    :is="typeComponent"
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
  DitoErrors(:errors="errors")
</template>

<script>
import { isString, isNumber } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { getTypeComponent, alignBottom, omitPadding } from '../utils/schema.js'
import { parseFraction } from '../utils/math.js'

// @vue/component
export default DitoComponent.component('DitoContainer', {
  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, default: '' },
    data: { type: [Object, Array], required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    single: { type: Boolean, default: false },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: false }
  },

  data() {
    return {
      errors: null
    }
  },

  computed: {
    context() {
      return new DitoContext(this, { nested: this.nested })
    },

    typeComponent() {
      return getTypeComponent(this.schema.type)
    },

    hasLabel() {
      const { label } = this.schema
      return (
        label !== false && (
          !!label ||
          this.generateLabels && this.typeComponent?.generateLabel
        )
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
      type: [String, Number],
      default() {
        return this.typeComponent?.defaultWidth
      },
      get(width) {
        // Use 100% == 1.0 as default width when nothing is set:
        return width === undefined
          ? 1.0
          : isString(width)
            ? width.match(/^\s*[<>]?\s*(.*)$/)[1] // Remove width operator
            : width
      }
    }),

    componentWidthOperator: getSchemaAccessor('width', {
      type: String,
      get(width) {
        return isString(width)
          ? width.match(/^\s*([<>]?)/)[1] || null
          : null
      }
    }),

    componentVisible: getSchemaAccessor('visible', {
      type: Boolean,
      default() {
        return this.typeComponent?.defaultVisible
      }
    }),

    componentDisabled: getSchemaAccessor('disabled', {
      type: Boolean,
      default: false,
      get(disabled) {
        return disabled || this.disabled
      }
    }),

    containerClass() {
      const { class: containerClass } = this.schema
      const prefix = 'dito-container'
      return {
        [`${prefix}--single`]: this.single,
        [`${prefix}--has-label`]: this.hasLabel,
        [`${prefix}--align-bottom`]: alignBottom(this.schema),
        [`${prefix}--omit-padding`]: omitPadding(this.schema),
        ...(
          isString(containerClass)
            ? { [containerClass]: true }
            : containerClass
        )
      }
    },

    componentBasis() {
      const width = this.componentWidth
      // 'auto' = no fitting:
      const basis = [null, 'auto', 'fill'].includes(width)
        ? 'auto'
        : /%$/.test(width)
          ? parseFloat(width) // percentage
          : /[a-z]/.test(width)
            ? width // native units
            : parseFraction(width) * 100 // fraction
      return isNumber(basis) ? `${basis}%` : basis
    },

    containerStyle() {
      // Interpret '>50%' as '50%, flex-grow: 1`
      const grow = (
        this.componentWidthOperator === '>' ||
        this.componentWidth === 'fill'
      )
      // Interpret '<50%' as '50%, flex-shrink: 1`
      const shrink = this.componentWidthOperator === '<'
      return {
        flex: `${grow ? 1 : 0} ${shrink ? 1 : 0} ${this.componentBasis}`
      }
    },

    componentClass() {
      const basisIsAuto = this.componentBasis === 'auto'
      return {
        // TODO: BEM?
        'dito-single': this.single,
        'dito-disabled': this.componentDisabled,
        'dito-width-fill': !basisIsAuto || this.componentWidth === 'fill',
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

<style lang="scss">
@import '../styles/_imports';

.dito-container {
  display: flex;
  flex-flow: column;
  align-items: flex-start;
  // Needed for better vertical alignment:
  align-self: stretch;
  box-sizing: border-box;
  // To prevent list tables from blowing out of their flex box containers.
  max-width: 100%;
  // Cannot use margin here as it needs to be part of box-sizing for
  // percentages in flex-basis to work.
  padding: $form-spacing $form-spacing-half;

  &:empty {
    padding: 0;
  }

  &--single {
    height: 100%; // So that list buttons can be sticky at the bottom;
    // Just like on DitoPane, clear settings from above.
    padding: 0;
  }

  &--align-bottom {
    justify-content: end; // To align components with and without labels.
  }

  &--omit-padding {
    padding: 0;

    > .dito-label {
      margin: $form-spacing $form-spacing-half 0;
    }
  }
}

// NOTE: This is not nested inside `.dito-container` so that other
// type components can override `.dito-width-fill` class (filter precedence).
.dito-component {
  &.dito-width-fill {
    width: 100%;

    &.dito-checkbox,
    &.dito-radio-button {
      // WebKit doesn't like changed width on checkboxes and radios, override:
      display: inline-block;
      width: auto;
    }
  }
}
</style>
