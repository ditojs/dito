<template lang="pug">
.dito-container(
  v-show="componentVisible"
  :class="containerClass"
  :style="containerStyle"
)
  DitoLabel(
    v-if="hasLabel"
    :class="componentClass"
    :label="label"
    :dataPath="labelDataPath"
    :info="info"
  )
  component.dito-component(
    :is="typeComponent"
    :class="componentClass"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :width="width"
    :label="label"
    :single="single"
    :nested="nested"
    :disabled="componentDisabled"
    @errors="onErrors"
  )
  DitoErrors(:errors="errors")
</template>

<script>
import { isString, isNumber } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { getTypeComponent, keepAligned, omitPadding } from '../utils/schema.js'
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
    generateLabels: { type: Boolean, default: false },
    firstInRow: { type: Boolean, default: false },
    lastInRow: { type: Boolean, default: false }
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

    info: getSchemaAccessor('info', {
      type: String,
      default: null
    }),

    width: getSchemaAccessor('width', {
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

    widthOperator: getSchemaAccessor('width', {
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

    flexGrow() {
      // Interpret '>50%' as '50%, flex-grow: 1`
      return (
        this.widthOperator === '>' ||
        this.width === 'fill'
      )
    },

    flexShrink() {
      // Interpret '<50%' as '50%, flex-shrink: 1`
      return this.widthOperator === '<'
    },

    flexBasis() {
      const width = this.width
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

    containerClass() {
      const { class: containerClass } = this.schema
      const prefix = 'dito-container'
      return {
        [`${prefix}--single`]: this.single,
        [`${prefix}--has-label`]: this.hasLabel,
        [`${prefix}--aligned`]: keepAligned(this.schema),
        [`${prefix}--omit-padding`]: omitPadding(this.schema),
        [`${prefix}--first-in-row`]: this.firstInRow,
        [`${prefix}--last-in-row`]: this.lastInRow,
        [`${prefix}--alone-in-row`]: this.firstInRow && this.lastInRow,
        ...(
          isString(containerClass)
            ? { [containerClass]: true }
            : containerClass
        )
      }
    },

    containerStyle() {
      return {
        flex: `${
          this.flexGrow ? 1 : 0
        } ${
          this.flexShrink ? 1 : 0
        } ${
          this.flexBasis
        }`
      }
    },

    componentClass() {
      const basisIsAuto = this.flexBasis === 'auto'
      return {
        // TODO: BEM?
        'dito-single': this.single,
        'dito-disabled': this.componentDisabled,
        'dito-width-fill': !basisIsAuto || this.width === 'fill',
        'dito-width-grow': this.flexGrow,
        'dito-width-shrink': this.flexShrink,
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
  $self: &;

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

  &--aligned {
    // For components with labels, align the label at the top and the component
    // at the bottom.
    --justify: space-between;

    &:has(> :only-child) {
      // But if there is no label, still align the component to the bottom.
      --justify: flex-end;
    }

    &:not(#{$self}--alone-in-row) {
      // Now only apply alignment if there are neighbouring components no the
      // same row that also align.
      // Look ahead:
      &:not(#{$self}--last-in-row) + #{&}:not(#{$self}--first-in-row),
      // Look behind:
      &:not(#{$self}--last-in-row):has(+ #{&}:not(#{$self}--first-in-row)) {
        justify-content: var(--justify);
      }
    }
  }

  &--drop-target {
    background: $content-color-background;
    border-radius: $border-radius;
    z-index: $drag-overlay-z-index + 1;
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
