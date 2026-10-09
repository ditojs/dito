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
    v-if="shouldRenderLabel"
    :class="labelClasses"
    :htmlFor="labelHtmlFor"
    :label="label"
    :info="info"
  )
  component.dito-component(
    v-if="!(hasLabel && isLabel)"
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
    :errorsElementId="errorsElementId"
    @errors="onErrors"
    @update:component="value => (component = value)"
  )
  DitoErrors(
    :id="errorsElementId"
    :errors="errors"
  )
</template>

<script>
import { isString, isNumber } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import ValueMixin from '../mixins/ValueMixin.js'
import ContextMixin from '../mixins/ContextMixin.js'
import DitoContext from '../DitoContext.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { getTypeComponent } from '../utils/schema/types.js'
import { hasLabel, omitSpacing } from '../utils/schema/structure.js'
import { getAllPanelEntries } from '../utils/schema/lookup.js'
import { parseFraction } from '../utils/math.js'
import { appendDataPath } from '../utils/data.js'

// @vue/component
export default DitoComponent.component('DitoContainer', {
  mixins: [ValueMixin, ContextMixin],

  provide() {
    return {
      $accumulatedBasis: () => this.combinedBasis
    }
  },

  inject: {
    // The basis of the closest ancestor container as a fraction of the width
    // of the closest non-inlined schema, which provides `1`, see `DitoSchema`.
    // The default is a factory that returns the injected function.
    $accumulatedBasis: { default: () => () => 1 }
  },

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, default: '' },
    data: { type: [Object, Array], required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    single: { type: Boolean, default: false },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, required: true },
    compact: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false },
    verticalLabels: { type: Boolean, default: false }
  },

  data() {
    return {
      errors: null,
      // The nested type component instance, for context-based schema accessor
      // evaluation.
      component: null
    }
  },

  computed: {
    context() {
      return new DitoContext(
        // When available, use the type component for context-based schema
        // accessors, but fall back to container.
        // TODO: Consider architectural inversion to eliminate timing issues:
        // - Type components render DitoContainer at their root
        // - Pass type component content through container's default slot
        // - DitoPane/DitoButtons render type components directly
        // - Eliminates need for component instance synchronization
        // - Provides true synchronous access to component context
        this.component ?? this,
        { nested: this.nested }
      )
    },

    name() {
      return this.schema.name
    },

    componentPath() {
      // Add the component's name, also for unnested components that don't
      // add it to their data path, see `DitoMixin.componentPath`.
      return appendDataPath(this.parentComponent.componentPath, this.name)
    },

    type() {
      return this.schema.type
    },

    typeComponent() {
      return getTypeComponent(this.type)
    },

    isLabel() {
      return this.type === 'label'
    },

    hasLabel() {
      return hasLabel(this.schema, this.generateLabels)
    },

    label() {
      return this.hasLabel ? this.getLabel(this.schema) : null
    },

    shouldRenderLabel() {
      // Type components can display the label themselves, e.g. sections in the
      // header of their schema. They still receive it through `label`.
      return (
        this.hasLabel &&
        !this.typeComponent?.rendersOwnLabel?.(this.context)
      )
    },

    errorsElementId() {
      return `${this.componentPath}-errors`
    },

    labelHtmlFor() {
      // Type components use their component path as DOM id. Unnested types
      // don't display a value of their own to label:
      return this.nested ? this.componentPath : null
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
      const accumulatedBasis = this.$accumulatedBasis()
      const { flexBasis } = this
      return isNumber(accumulatedBasis) && isNumber(flexBasis)
        ? accumulatedBasis * flexBasis
        : null
    },

    containerClasses() {
      const { class: classes } = this.schema
      const prefix = 'dito-container'
      return {
        [`${prefix}--disabled`]: this.componentDisabled,
        [`${prefix}--has-errors`]: !!this.errors,
        [`${prefix}--single`]: this.single,
        [`${prefix}--compact`]: this.compact,
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
        'dito-component--single': this.single,
        ...this.getLayoutClasses('dito-component')
      }
    },

    labelClasses() {
      return {
        'dito-label--visible': this.isLabel,
        ...this.getLayoutClasses('dito-label')
      }
    },

    panelEntries() {
      return getAllPanelEntries(
        this.api,
        this.schema,
        this.dataPath,
        // The panel of the type is addressed relative to the data path, which
        // unnested components don't add their name to:
        this.nested ? this.componentPath : this.parentComponent.componentPath,
        this.componentPath,
        this.$refs.component,
        this.tabComponent?.panelTab ?? null
      )
    }
  },

  methods: {
    getLayoutClasses(prefix) {
      return {
        [`${prefix}--fill`]: this.width === 'fill' || this.flexBasis !== 'auto',
        [`${prefix}--grow`]: this.flexGrow,
        [`${prefix}--shrink`]: this.flexShrink
      }
    },

    onErrors(errors) {
      this.errors = errors
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

@mixin narrow-page-layout($content-width) {
  @container dito-page (width <= #{0.8 * $content-width}) {
    flex-grow: 1;
    flex-basis: var(--basis-mobile, var(--basis));
  }

  @container dito-page (width <= #{0.6 * $content-width}) {
    flex-basis: calc(2 * var(--basis));
  }
}

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
  padding: var(--container-padding);

  > .dito-label:not(.dito-label--visible):only-child {
    // Used e.g. when sources hide themselves due to maxDepth, but the label
    // is rendered above it.
    display: none;
  }

  &:empty {
    padding: 0;
  }

  // Let the components grow and wrap in pages and sidebars that are narrower
  // than the width that their schemas are laid out for:
  .dito-pane > & {
    .dito-page:not(.dito-page--wide) & {
      @include narrow-page-layout($content-width);
    }

    .dito-page--wide & {
      @include narrow-page-layout($content-width-wide);
    }

    @container dito-sidebar (width < #{$sidebar-max-width}) {
      flex-grow: 1;
    }

    @container dito-sidebar (width <= #{0.6 * $sidebar-max-width}) {
      flex-basis: calc(2 * var(--basis));
    }
  }

  &--single {
    height: 100%; // So that list buttons can be sticky at the bottom;
  }

  &--label-vertical {
    // For plain components without labels in rows with other components that
    // have labels, add some spacing to the top to align with the other
    // components (e.g.  buttons):
    > .dito-component:first-child:not(.dito-section, .dito-list, .dito-object) {
      margin-top: $input-height;
    }
  }

  &--compact:not(&--label-vertical) {
    // Display labels in compact schema as inline-blocks, to allow compact
    // layouts with `width: 'auto'` elements:
    display: flex;
    flex-flow: row wrap;
    align-items: center;
  }

  &--omit-spacing {
    padding: 0;

    > .dito-label {
      margin: $form-spacing-half $form-spacing-half 0;
    }
  }
}

.dito-component {
  position: relative;

  &--fill {
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
