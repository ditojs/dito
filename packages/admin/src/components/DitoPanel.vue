<template lang="pug">
//- Only show panels in tabs when the tabs are also visible.
component.dito-panel(
  v-if="shouldRenderPanel"
  v-show="visible && (!isTabSelected || isTabSelected())"
  :is="panelTag"
  role="region"
  :aria-label="getLabel(schema)"
  @submit.prevent
)
  DitoSchema.dito-panel__schema(
    :schema="schema"
    :dataSchema="panelDataSchema"
    :dataPath="panelDataPath"
    :data="panelData"
    :store="store"
    padding="nested"
    :disabled="disabled"
    :hasOwnData="hasOwnData"
    generateLabels
  )
    template(#prepend)
      h2.dito-panel__header(:class="{ 'dito-panel__header--sticky': sticky }")
        span {{ getLabel(schema) }}
        DitoButtons.dito-buttons--small.dito-panel__header-buttons(
          :buttons="panelButtonSchemas"
          buttonsName="panelButtons"
          :dataPath="panelDataPath"
          :data="panelData"
          :store="store"
          :disabled="disabled"
        )
    template(#buttons)
      DitoButtons.dito-panel__buttons(
        :buttons="buttonSchemas"
        :dataPath="panelDataPath"
        :data="panelData"
        :store="store"
        :disabled="disabled"
      )
</template>

<script>
import { computed, inject, reactive, toRefs } from 'vue'
import { isFunction } from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { useContainer } from '../composables/useContainer.ts'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { schemaContextKey } from '../utils/keys.ts'
import { getButtonSchemas } from '../utils/schema/lookup.js'
import { shouldRenderComponents } from '../utils/schema/data.js'
import { getRootData } from '../utils/services.ts'

export default {
  name: 'DitoPanel',

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    // For panels of components in tabs:
    isTabSelected: { type: Function, default: null },
    panelComponentPath: { type: String, required: true }
  },

  setup(props) {
    useComponentPath(
      () => props.dataPath,
      () => props.panelComponentPath
    )
    // The panel decides about itself in the data around it, e.g. in `if` and
    // `data()`, while its components and buttons see the data it displays:
    const schemaContext = inject(schemaContextKey)
    const { context, services } = useSchemaContext(
      reactive({
        ...toRefs(props),
        dataPath: computed(() => schemaContext.dataPath)
      })
    )
    const { getSchemaValue, getLabel } = useSchemaValue(context)
    // Own data gets its own container, so that its edits don't make the data
    // around the panel dirty. It's addressed by the panel's data path, within
    // the root data around it:
    const { data } = props.schema
    const container = data
      ? useContainer({
          schema: () => props.schema,
          data: isFunction(data) ? data(context) : data,
          dataPath: () => props.dataPath,
          rootData: () => getRootData(services),
          componentPath: () => props.panelComponentPath,
          parentModel: () => services.dataContext?.model ?? null
        })
      : null
    const hasOwnData = !!container
    const panelData = computed(() => container?.dataContext.data ?? props.data)
    const panelDataPath = computed(() =>
      hasOwnData ? props.dataPath : schemaContext.dataPath
    )
    const panelServices = container?.services ?? services

    return {
      getLabel,
      hasOwnData,
      panelData,
      panelDataPath,

      shouldRenderPanel: computed(
        () => (
          getSchemaValue('if', { type: Boolean, default: true }) &&
          shouldRenderComponents(
            props.schema,
            new SchemaContext(panelServices, {
              nested: false,
              data: panelData.value,
              dataPath: panelDataPath.value
            })
          )
        )
      ),

      // Panels that provide their own data need their own form.
      panelTag: hasOwnData ? 'form' : 'div',
      panelDataSchema: computed(() =>
        hasOwnData ? props.schema : schemaContext.schema
      ),

      buttonSchemas: computed(() => getButtonSchemas(props.schema.buttons)),

      panelButtonSchemas: computed(() =>
        getButtonSchemas(props.schema.panelButtons)
      ),

      visible: computed(() =>
        getSchemaValue('visible', { type: Boolean, default: true })
      ),

      sticky: computed(() =>
        getSchemaValue('sticky', { type: Boolean, default: false })
      )
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-panel {
  $self: &;

  &:not(:last-child) {
    margin-bottom: $content-padding;
  }

  &__header {
    display: block;
    position: relative;
    box-sizing: border-box;
    padding: $input-padding;
    background: $button-color;
    border: $border-style;
    border-top-left-radius: $border-radius;
    border-top-right-radius: $border-radius;

    &--sticky {
      $margin: $input-height-factor * $line-height * $font-size-small +
        $form-spacing;

      position: sticky;
      top: $content-padding;
      margin-bottom: $margin;
      z-index: 1;

      & + * {
        margin-top: -$margin;
      }

      &::before {
        content: '';
        display: block;
        position: absolute;
        background: $content-color-background;
        left: 0;
        right: 0;
        height: $content-padding;
        top: -$content-padding;
        margin: -$border-width;
      }
    }
  }

  &__header-buttons {
    position: absolute;
    right: $input-padding-ver;
    top: 50%;
    transform: translateY(-50%);
  }

  &__schema {
    font-size: $font-size-small;
    background: $content-color-background;
    border: $border-style;
    border-top: 0;
    border-bottom-left-radius: $border-radius;
    border-bottom-right-radius: $border-radius;

    > .dito-schema-content {
      .dito-object {
        border: none;
        padding: 0;
      }
    }

    // Nested, to override the margin of `.dito-buttons`:
    #{$self}__buttons {
      --button-margin: #{$form-spacing};

      padding: $form-spacing;
    }

    .dito-label {
      label {
        font-weight: normal;
      }
    }
  }
}
</style>
