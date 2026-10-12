<!-- eslint-disable vue/no-template-shadow -->
<template lang="pug">
.dito-pane(
  v-if="dataContext.hasData && componentSchemas.length > 0"
  :id="tabPanelId"
  v-resize="onResizePane"
  :role="tab ? 'tabpanel' : null"
  :aria-labelledby="tabId"
  :class="classes"
)
  template(
    v-for=`{
      schema,
      dataPath,
      nestedDataPath,
      nested,
      store
    }, index in componentSchemas`
  )
    //- A <span>, for the `.dito-container:first-of-type` selector:
    span.dito-pane__break(
      v-if="['before', 'both'].includes(schema.break)"
    )
    DitoContainer(
      v-if="shouldRenderComponentByIndex[index]"
      ref="containers"
      :key="nestedDataPath"
      :data-index="index"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :store="store"
      :single="isSingleComponent"
      :nested="nested"
      :disabled="disabled"
      :compact="compact"
      :generateLabels="generateLabels"
      :verticalLabels="isInLabeledRow(index)"
    )
    span.dito-pane__break(
      v-if="['after', 'both'].includes(schema.break)"
    )
</template>

<script>
import {
  computed,
  inject,
  nextTick,
  provide,
  ref,
  unref,
  useTemplateRef,
  watch
} from 'vue'
import SchemaContext from '../SchemaContext.js'
import { useServices } from '../composables/useSchemaContext.ts'
import { useStore } from '../composables/useStore.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { getRootData } from '../utils/services.ts'
import { appendDataPath } from '../utils/data.js'
import {
  hasLabel,
  hasNestedData,
  isInlined
} from '../utils/schema/structure.js'
import { shouldRenderSchema } from '../utils/schema/data.js'
import { getItemAdapter } from '../utils/schema/types.ts'
import { panelTabKey, sourceSchemaKey } from '../utils/keys.ts'

export default {
  name: 'DitoPane',

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    store: { type: Object, required: true },
    tab: { type: String, default: null },
    selected: { type: Boolean, default: false },
    single: { type: Boolean, default: false },
    padding: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
  },

  setup(props) {
    const services = useServices()
    const { getChildStore } = useStore(props)
    const sourceSchema = inject(sourceSchemaKey, null)
    // Tabs add their name, as they don't appear in data paths:
    const { parentComponentPath } = useComponentPath(
      () => props.dataPath,
      parent =>
        props.tab ? appendDataPath(parent.path, props.tab) : parent.path
    )
    if (props.tab) {
      provide(panelTabKey, {
        tabName: props.tab,
        isTabSelected: () => props.selected
      })
    }
    const containers = useTemplateRef('containers')
    const positions = ref([])

    // NOTE: The schema can be null while multi-form lists load their data. The
    // value of an item adapter keeps the item's data path in inlined items, as
    // their list holds its errors. Routed forms edit a draft of the item:
    const componentSchemas = computed(() => {
      const source = unref(sourceSchema)
      const itemAdapter =
        source && isInlined(source) ? getItemAdapter(source) : null
      return Object.entries(props.schema?.components || {}).map(
        ([name, schema]) => {
          // The schema may be used elsewhere too:
          schema = { ...schema, name }
          const nested = hasNestedData(schema)
          const nestedDataPath = appendDataPath(props.dataPath, name)
          const dataPath =
            nested && name !== itemAdapter?.name
              ? nestedDataPath
              : props.dataPath
          return {
            schema,
            dataPath,
            nestedDataPath,
            nested,
            store: getChildStore(name),
            // Also of type components that render their own label:
            hasLabel: hasLabel(schema, props.generateLabels)
          }
        }
      )
    })

    const isSingleComponent = computed(
      () => props.single && componentSchemas.value.length === 1
    )

    // Evaluate the `if` of the components before they're rendered:
    const shouldRenderComponentByIndex = computed(() =>
      componentSchemas.value.map(({ schema, nested, dataPath }) =>
        shouldRenderSchema(
          schema,
          SchemaContext.createForSchema(services, {
            schema,
            name: schema.name,
            nested,
            data: props.data,
            dataPath,
            rootData: getRootData(services)
          })
        )
      )
    )

    const verticalLabelsByIndices = computed(() => {
      // Removed containers don't necessarily resize the pane:
      const renderedPositions = positions.value.map((position, index) =>
        shouldRenderComponentByIndex.value[index] ? position : null
      )

      const findNextPosition = index => {
        for (let i = index + 1; i < renderedPositions.length; i++) {
          if (renderedPositions[i]) return renderedPositions[i]
        }
        return 0
      }

      const isLastInRow = index => (
        renderedPositions[index] && (
          index === renderedPositions.length - 1 ||
          findNextPosition(index).top > renderedPositions[index].top
        )
      )

      const rows = []
      let row = []
      for (let index = 0; index < renderedPositions.length; index++) {
        row.push(index)
        if (isLastInRow(index)) {
          rows.push(row)
          row = []
        }
      }
      if (row.length > 0) {
        rows.push(row)
      }

      const verticalLabelsByIndices = []
      for (const row of rows) {
        // Compact labels display next to their components, so only count the
        // ones of containers higher than one line.
        // TODO: Detect the labels in nested schemas too.
        const hasLabelsInRow = row.some(
          index => (
            renderedPositions[index]?.height > 2 &&
            componentSchemas.value[index].hasLabel
          )
        )
        for (const index of row) {
          verticalLabelsByIndices[index] = hasLabelsInRow
        }
      }
      return verticalLabelsByIndices
    })

    watch(
      () => componentSchemas.value.length,
      length => {
        positions.value.length = length
      }
    )

    return {
      dataContext: services.dataContext,
      positions,
      componentSchemas,
      isSingleComponent,
      shouldRenderComponentByIndex,

      // See `DitoTabs.getTabId()` and `getTabPanelId()`:
      tabId: computed(() =>
        props.tab ? `${parentComponentPath.value}-tab-${props.tab}` : null
      ),

      tabPanelId: computed(() =>
        props.tab ? `${parentComponentPath.value}-tabpanel-${props.tab}` : null
      ),

      classes: computed(() => {
        const prefix = 'dito-pane'
        return {
          [`${prefix}--single`]: isSingleComponent.value,
          [`${prefix}--padding-${props.padding}`]: !!props.padding
        }
      }),

      isInLabeledRow(index) {
        return !!verticalLabelsByIndices.value[index]
      },

      onResizePane() {
        nextTick(() => {
          // The containers aren't rendered anymore if the pane was emptied or
          // unmounted in the meantime.
          for (const container of containers.value ?? []) {
            const node = container.$el
            const index = +node.dataset.index
            const bounds = node.getBoundingClientRect()
            const style = getComputedStyle(node)
            const padding = parseFloat(style.padding)
            const fontSize = parseFloat(style.fontSize)
            const height = bounds.height - 2 * padding
            positions.value[index] =
              height <= 0 ? null : { top: bounds.y, height: height / fontSize }
          }
        })
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-pane {
  $self: &;
  $root-padding: $content-padding - $form-spacing-half;

  --pane-padding: 0px;
  --container-padding: #{$form-spacing-half};

  display: flex;
  position: relative;
  flex-flow: row wrap;
  align-items: flex-start;
  align-content: flex-start;
  // Remove the padding added by `.dito-container` inside `.dito-pane`:
  margin: -$form-spacing-half;
  padding: var(--pane-padding);
  // Use `flex: 0%` for all `.dito-pane` except `.dito-pane__main`,
  // so that the `.dito-buttons--main` can be moved all the way to the bottom.
  flex: 0%;

  &__main {
    flex: 100%;
  }

  &--padding-root {
    // A root-level pane inside a scroll view. Clear negative margin from above.
    margin: 0;
    // Move the negative margin used to remove the padding added by
    // `.dito-container` inside `.dito-pane` to the padding:
    --pane-padding: #{$root-padding};

    &#{$self}--single {
      --pane-padding: #{$content-padding};
      --container-padding: 0px;
    }

    &:has(> .dito-container--label-vertical:first-of-type) {
      // Reduce top spacing when the first row has labels.
      margin-top: -$form-spacing-half;
    }

    // Display a ruler between the tabbed components and the main components.
    // `dito-pane__tab` and `dito-pane__main` are set on the panes themselves,
    // see `DitoSchema`:
    &#{$self}__tab + #{$self}__main {
      &::before {
        // Use a pseudo element to display a ruler with proper margins
        display: block;
        content: '';
        width: 100%;
        border-bottom: $border-style;
        // Shift ruler up by $root-padding to exclude removed $form-spacing-half
        margin: (-$root-padding) $form-spacing-half $root-padding;
        padding: $form-spacing-half;
      }
    }
  }

  &--padding-inlined {
    --pane-padding: 0px;
  }

  &--padding-nested {
    --pane-padding: #{$form-spacing};

    &:has(> .dito-container--label-vertical:first-of-type) {
      // Reduce top spacing when the first row has labels.
      padding-top: $form-spacing-half;
    }
  }

  &__break {
    // `&_break` is rendered as <span> so we can use the
    // `.dito-container:first-of-type` selector to match the first container
    // even if it has a break before it.
    display: block;
    flex: 100%;
    height: 0;
  }
}
</style>
