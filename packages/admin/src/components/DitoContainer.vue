<template lang="pug">
.dito-container(
  v-show="componentVisible"
  :class="[containerClasses, schema.class]"
  :style="containerStyles"
)
  //- Routes that are hidden by the forms of their items hide their panels:
  Teleport(
    v-if="isMounted && isRouteShown && panelEntries.length > 0"
    to=".dito-sidebar__teleport"
  )
    DitoPanels(
      :panels="panelEntries"
      :data="data"
      :store="store"
      :disabled="disabled"
    )
  DitoLabel(
    v-if="shouldRenderLabel"
    :id="labelId"
    :class="labelClasses"
    :htmlFor="labelHtmlFor"
    :label="label"
    :context="context"
    :info="info"
    :required="isRequired"
    :hasButtons="!!labelId"
    :collapsible="!!labelToggle"
    :collapsed="labelToggle?.collapsed"
    :togglesAll="!!labelToggle"
    :title="labelToggle?.title"
    @toggle="labelToggle.toggle()"
  )
  component.dito-component(
    v-if="!isReplacedWithLabel"
    :is="typeComponent"
    ref="component"
    :class="componentClasses"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :store="store"
    :field="field"
    :single="single"
    :nested="nested"
    :errorsElementId="errors ? errorsElementId : null"
    :labelId="labelId"
  )
    //- The content that layouts place in custom components, see
    //- `DitoSchemaField`, and the items of widgets with their slot props:
    template(
      v-if="$slots.default"
      #default="slotProps"
    )
      slot(
        v-bind="slotProps"
      )
  DitoErrors(
    :id="errorsElementId"
    :errors="errors"
  )
</template>

<script>
import {
  computed,
  inject,
  onMounted,
  provide,
  ref,
  shallowRef,
  unref
} from 'vue'
import { isString, isNumber, isFunction } from '@ditojs/utils'
import { useContainerField } from '../composables/useField.ts'
import { getTypeComponent, getTypeDescriptor } from '../utils/schema/types.ts'
import { omitsSpacing, isPanel } from '../utils/schema/structure.js'
import { getAllPanelEntries } from '../utils/schema/lookup.js'
import { getDataKeywords } from '../utils/schema/properties.js'
import { parseFraction } from '../utils/math.js'
import {
  accumulatedBasisKey,
  labelToggleKey,
  panelTabKey,
  visibleKey
} from '../utils/keys.ts'

const alignments = ['top', 'center', 'bottom']

export default {
  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, default: '' },
    data: { type: [Object, Array], required: true },
    // The data path of `data`, e.g. of the wrappers of primitives:
    itemDataPath: { type: String, required: true },
    store: { type: Object, required: true },
    single: { type: Boolean, default: false },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, required: true },
    compact: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false },
    verticalLabels: { type: Boolean, default: false }
  },

  setup(props) {
    const field = useContainerField(props)
    const {
      context,
      services,
      componentPath,
      parentComponentPath,
      getSchemaValue,
      label,
      labelText,
      disabled
    } = field
    // A fraction of the width of the closest non-inlined schema:
    const accumulatedBasis = inject(accumulatedBasisKey, 1)
    const panelTab = inject(panelTabKey, null)
    const isParentVisible = inject(visibleKey, true)
    const isMounted = ref(false)
    onMounted(() => {
      isMounted.value = true
    })

    const typeDescriptor = computed(() => getTypeDescriptor(props.schema.type))
    const hasSchemaLabel = computed(() => label.value !== null)

    const width = computed(() => {
      const width = getSchemaValue('width', {
        type: [String, Number],
        default: () => typeDescriptor.value?.defaultWidth
      })
      return width === undefined
        ? 1.0 // Full width by default.
        : isString(width)
          ? width.match(/^\s*[<>]?\s*(.*)$/)[1] // Remove width operator
          : width
    })

    const widthOperator = computed(() => {
      const width = getSchemaValue('width', { type: String })
      return isString(width) ? width.match(/^\s*([<>]?)/)[1] || null : null
    })

    // Interpret '>50%' as '50%, flex-grow: 1`, and '<' as flex-shrink:
    const flexGrow = computed(
      () => widthOperator.value === '>' || width.value === 'fill'
    )

    const flexShrink = computed(() => widthOperator.value === '<')

    const flexBasis = computed(() => {
      const value = width.value
      return [null, 'auto', 'fill'].includes(value)
        ? 'auto'
        : /%$/.test(value)
          ? parseFloat(value) / 100 // percentage -> fraction
          : /[a-z]/.test(value)
            ? value // native units
            : parseFraction(value) // fraction
    })

    const combinedBasis = computed(() => {
      const basis = unref(accumulatedBasis)
      return isNumber(basis) && isNumber(flexBasis.value)
        ? basis * flexBasis.value
        : null
    })
    provide(accumulatedBasisKey, combinedBasis)
    // The type component registers the toggle of all its items for the label:
    const labelToggle = shallowRef(null)
    provide(labelToggleKey, labelToggle)

    // Unnested components share the data path of their parent, which their
    // errors don't belong to:
    const errors = computed(() => {
      if (props.nested) {
        const { model } = services.dataContext
        const { dataPath } = props
        const fieldLabel = (
          labelText.value ||
          field.placeholder.value ||
          props.schema.name
        )
        const errors = [
          ...(model.errors.get(dataPath) ?? []).map(({ message, path }) =>
            path
              ? `The ${fieldLabel} field's ${path} ${message}.`
              : `The ${fieldLabel} field ${message}.`
          ),
          ...(model.errors.getFieldMessages(dataPath) ?? [])
        ]
        return errors.length > 0 ? errors : null
      }
      return null
    })
    const componentVisible = computed(() =>
      getSchemaValue('visible', {
        type: Boolean,
        default: () => typeDescriptor.value?.defaultVisible
      })
    )
    const isVisible = computed(
      () => componentVisible.value && unref(isParentVisible)
    )
    provide(visibleKey, isVisible)

    const getLayoutClasses = prefix => ({
      [`${prefix}--fill`]: width.value === 'fill' || flexBasis.value !== 'auto',
      [`${prefix}--grow`]: flexGrow.value,
      [`${prefix}--shrink`]: flexShrink.value
    })

    const isReplacedWithLabel = computed(
      () => hasSchemaLabel.value && !!typeDescriptor.value?.rendersLabel
    )

    // Type components can display the label themselves, e.g. sections:
    const shouldRenderLabel = computed(() => {
      const hasLabel = typeDescriptor.value?.hasLabel ?? true
      return (
        hasSchemaLabel.value &&
        (isFunction(hasLabel) ? hasLabel(context) : hasLabel)
      )
    })

    return {
      field,
      context,
      componentPath,
      isMounted,
      label,
      info: field.info,
      errors,
      isReplacedWithLabel,
      typeComponent: computed(() => getTypeComponent(props.schema.type)),
      componentVisible,

      shouldRenderLabel,
      labelToggle,
      // Mark the labels of values that validation requires:
      isRequired: computed(
        () => !!getDataKeywords(props.schema, context).required
      ),

      errorsElementId: computed(() => `${componentPath.value}-errors`),

      // Type components teleport their buttons into the row of the label:
      labelId: computed(() =>
        shouldRenderLabel.value && typeDescriptor.value?.hasLabelButtons
          ? `${componentPath.value}-label`
          : null
      ),

      // Type components use their component path as DOM id:
      labelHtmlFor: computed(() => (props.nested ? componentPath.value : null)),

      containerClasses: computed(() => {
        const align = getSchemaValue('align', { type: String })
        const prefix = 'dito-container'
        return {
          [`${prefix}--disabled`]: disabled.value,
          [`${prefix}--has-errors`]: !!errors.value,
          [`${prefix}--single`]: props.single,
          [`${prefix}--compact`]: props.compact,
          [`${prefix}--label-vertical`]: props.verticalLabels,
          [`${prefix}--below-labels`]: (
            props.verticalLabels &&
            !!typeDescriptor.value?.alignsBelowLabels
          ),
          [`${prefix}--omit-spacing`]: omitsSpacing(props.schema),
          [`${prefix}--align-${align}`]: alignments.includes(align)
        }
      }),

      containerStyles: computed(() => {
        const basis = flexBasis.value
        const combined = combinedBasis.value
        return {
          '--grow': flexGrow.value ? 1 : 0,
          '--shrink': flexShrink.value ? 1 : 0,
          '--basis': isNumber(basis) ? `${basis * 100}%` : basis,
          '--basis-mobile':
            isNumber(combined) && combined <= 0.25 ? `${basis * 200}%` : null
        }
      }),

      componentClasses: computed(() => ({
        'dito-component--single': props.single,
        ...getLayoutClasses('dito-component')
      })),

      labelClasses: computed(() => ({
        'dito-label--visible': isReplacedWithLabel.value,
        ...getLayoutClasses('dito-label')
      })),

      isRouteShown: computed(() => services.routeContext?.isActive !== false),

      panelEntries: computed(() =>
        getAllPanelEntries(
          services.adminContext.api,
          props.schema,
          // The panel of the type is addressed relative to the data path, and
          // panels relative to the item that holds them, also nested ones:
          isPanel(props.schema) ? props.itemDataPath : props.dataPath,
          props.nested && !isPanel(props.schema)
            ? componentPath.value
            : parentComponentPath.value,
          componentPath.value,
          // The source of lists, for their filters:
          services.sourceContext,
          panelTab
        )
      )
    }
  }
}
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

  &--align-top {
    align-self: flex-start;
  }

  &--align-center {
    align-self: center;
  }

  &--align-bottom {
    align-self: flex-end;
  }

  &--single {
    height: 100%; // So that list buttons can be sticky at the bottom;
  }

  &--below-labels {
    // For plain components without labels in rows with other components that
    // have labels, add some spacing to the top to align with the other
    // components (e.g.  buttons):
    > .dito-component:first-child {
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
