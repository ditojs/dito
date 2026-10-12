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
        DitoButtons.dito-buttons--small(
          :buttons="panelButtonSchemas"
          buttonsName="panelButtons"
          :dataPath="panelDataPath"
          :data="panelData"
          :store="store"
          :disabled="disabled"
        )
    template(#buttons)
      DitoButtons(
        :buttons="buttonSchemas"
        :dataPath="panelDataPath"
        :data="panelData"
        :store="store"
        :disabled="disabled"
      )
</template>

<script>
import {
  computed,
  inject,
  markRaw,
  reactive,
  ref,
  toRef,
  toRefs
} from 'vue'
import { isFunction } from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import {
  useContainer,
  useSchemaContext
} from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { getButtonSchemas } from '../utils/schema/lookup.js'
import { shouldRenderComponents } from '../utils/schema/data.js'
import { DataContext } from '../utils/DataContext.ts'
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
    const schemaContext = inject('schemaContext')
    const { context, services } = useSchemaContext(
      reactive({
        ...toRefs(props),
        dataPath: computed(() => schemaContext.dataPath)
      })
    )
    const { getSchemaValue, getLabel } = useSchemaValue(context)
    const ownData = ref(null)
    const hasOwnData = computed(() => !!ownData.value)
    const panelData = computed(() => ownData.value || props.data)
    // Own data is addressed by the panel's data path, within the root data
    // around it:
    const panelDataPath = computed(() =>
      hasOwnData.value ? props.dataPath : schemaContext.dataPath
    )

    // Own data gets its own container, so that its edits don't make the data
    // around the panel dirty:
    let panelServices = services
    if (props.schema.data) {
      const { data } = props.schema
      ownData.value = isFunction(data) ? data(context) : data
      const dataContext = markRaw(
        new DataContext(
          reactive({
            schema: toRef(props, 'schema'),
            data: ownData,
            dataPath: toRef(props, 'dataPath'),
            componentPath: toRef(props, 'panelComponentPath'),
            get dataModel() {
              return dataModel
            },
            get services() {
              return ownServices
            },
            setData(data) {
              ownData.value = data
              return ownData.value
            }
          })
        )
      )
      const { services: ownServices, createDataModel } = useContainer({
        dataContext
      })
      panelServices = ownServices
      const dataModel = createDataModel({
        schema: () => props.schema,
        data: () => ownData.value,
        rootData: () => getRootData(services),
        dataPath: () => props.dataPath,
        parent: () => services.dataContext?.model ?? null
      })
    }

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
      panelTag: computed(() => (hasOwnData.value ? 'form' : 'div')),

      panelDataSchema: computed(() =>
        hasOwnData.value ? props.schema : schemaContext.schema
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

    // TODO: BEM: Style an element class of this block, e.g. `&__buttons`.
    .dito-buttons {
      position: absolute;
      right: $input-padding-ver;
      top: 50%;
      transform: translateY(-50%);
    }
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

      // TODO: BEM: Style an element class of this block, e.g. `&__buttons`.
      > .dito-buttons {
        --button-margin: #{$form-spacing};

        padding: $form-spacing;

        .dito-container {
          padding: 0;
        }
      }
    }

    .dito-label {
      label {
        font-weight: normal;
      }
    }
  }
}
</style>
