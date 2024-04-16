<template lang="pug">
.dito-container(
  v-show="componentVisible"
  :class="containerClasses"
  :style="containerStyles"
)
  Teleport(
    v-if="isMounted && panelEntries.length > 0"
    to=".dito-sidebar__teleport"
  )
    DitoPanels(
      :panels="panelEntries"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
  DitoLabel(
    v-if="hasLabel"
    :class="layoutClasses"
    :label="label"
    :dataPath="labelDataPath"
    :info="info"
  )
  component.dito-component(
    :is="typeComponent"
    ref="component"
    :class="componentClasses"
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
    :accumulatedBasis="combinedBasis"
    @errors="onErrors"
  )
  DitoErrors(:errors="errors")
</template>

<script>
import { isString, isNumber } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import {
  getAllPanelEntries,
  getTypeComponent,
  hasLabel,
  omitSpacing
} from '../utils/schema.js'
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
    verticalLabels: { type: Boolean, default: false },
    accumulatedBasis: { type: Number, default: null }
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
      return hasLabel(this.schema, this.generateLabels)
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
      return [null, 'auto', 'fill'].includes(width)
        ? 'auto'
        : /%$/.test(width)
          ? parseFloat(width) / 100 // percentage -> fraction
          : /[a-z]/.test(width)
            ? width // native units
            : parseFraction(width) // fraction
    },

    combinedBasis() {
      const { accumulatedBasis, flexBasis } = this
      return isNumber(accumulatedBasis) && isNumber(flexBasis)
        ? accumulatedBasis * flexBasis
        : null
    },

    containerClasses() {
      const { class: classes } = this.schema
      const prefix = 'dito-container'
      return {
        [`${prefix}--single`]: this.single,
        'dito-disabled': this.componentDisabled,
        'dito-has-errors': !!this.errors,
        [`${prefix}--label-vertical`]: this.verticalLabels,
        [`${prefix}--omit-spacing`]: omitSpacing(this.schema),
        ...(isString(classes) ? { [classes]: true } : classes)
      }
    },

    containerStyles() {
      const { flexBasis, combinedBasis } = this
      return {
        '--grow': this.flexGrow ? 1 : 0,
        '--shrink': this.flexShrink ? 1 : 0,
        '--basis': isNumber(flexBasis) ? `${flexBasis * 100}%` : flexBasis,
        '--basis-mobile':
          isNumber(combinedBasis) && combinedBasis <= 0.25
            ? `${flexBasis * 200}%`
            : null
      }
    },

    componentClasses() {
      return {
        'dito-single': this.single,
        ...this.layoutClasses
      }
    },

    layoutClasses() {
      return {
        'dito-width-fill': this.width === 'fill' || this.flexBasis !== 'auto',
        'dito-width-grow': this.flexGrow,
        'dito-width-shrink': this.flexShrink
      }
    },

    panelEntries() {
      return getAllPanelEntries(
        this.api,
        this.schema,
        this.dataPath,
        this.$refs.component,
        this.tabComponent
      )
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
  --grow: 0;
  --shrink: 1;
  --basis: auto;

  position: relative;
  display: flex;
  flex: var(--grow) var(--shrink) var(--basis);
  flex-flow: column;
  align-items: flex-start;
  box-sizing: border-box;
  // To prevent list tables from blowing out of their flex box containers.
  max-width: 100%;
  // Cannot use margin here as it needs to be part of box-sizing for
  // percentages in flex-basis to work.
  padding: $form-spacing-half;

  > .dito-label:only-child {
    // Used e.g. when sources hide themselves due to maxDepth, but the label
    // is rendered above it.
    display: none;
  }

  .dito-pane > & {
    .dito-page--width-80 & {
      flex-grow: 1;
      flex-basis: var(--basis-mobile, var(--basis));
      // DEBUG: background: yellow;
    }

    .dito-page--width-60 & {
      flex-basis: calc(2 * var(--basis));
      // DEBUG: background: orange;
    }

    .dito-sidebar--width-99 & {
      flex-grow: 1;
      // DEBUG: background: yellow;
    }

    .dito-sidebar--width-60 & {
      flex-basis: calc(2 * var(--basis));
      // DEBUG: background: orange;
    }
  }

  &:empty {
    padding: 0;
  }

  &--single {
    height: 100%; // So that list buttons can be sticky at the bottom;
    // Just like on DitoPane, clear settings from above.
    padding: 0;
  }

  &--label-vertical {
    // For plain components without labels in rows with other components that
    // have labels, add some spacing to the top to align with the other
    // components (e.g.  buttons):
    > .dito-component:first-child:not(.dito-section, .dito-list, .dito-object) {
      margin-top: $input-height;
    }
  }

  &--omit-spacing {
    padding: 0;

    > .dito-label {
      margin: $form-spacing-half $form-spacing-half 0;
    }
  }
}

// NOTE: This is not nested inside `.dito-container` so that other
// type components can override `.dito-width-fill` class (filter precedence).
.dito-component {
  position: relative;

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
