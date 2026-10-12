<!-- eslint-disable vue/no-template-shadow -->
<template lang="pug">
.dito-pane(
  v-if="container.hasData && componentSchemas.length > 0"
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
    //- Use <span> for .dito-pane__break so we can use the
    //- `.dito-container:first-of-type` selector.
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
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import { appendDataPath } from '../utils/data.js'
import { hasLabel, hasNestedData } from '../utils/schema/structure.js'
import { shouldRenderSchema } from '../utils/schema/data.js'
import { getItemAdapter } from '../utils/schema/types.ts'

// @vue/component
export default DitoComponent.component('DitoPane', {
  provide() {
    // Tab panes tell their components about their tab, for their panels:
    return this.tab ? { panelTab: this.panelTab } : {}
  },

  inject: {
    sourceSchema: { default: null }
  },

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    store: { type: Object, required: true },
    tab: { type: String, default: null },
    single: { type: Boolean, default: false },
    padding: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
  },

  data() {
    return {
      positions: []
    }
  },

  computed: {
    classes() {
      const prefix = 'dito-pane'
      return {
        [`${prefix}--single`]: this.isSingleComponent,
        [`${prefix}--padding-${this.padding}`]: !!this.padding
      }
    },

    // Describes the tab of tab panes for the entries of the panels of their
    // components, see `getAllPanelEntries()`:
    panelTab() {
      const { tab, parentComponent } = this
      return tab
        ? {
            tabName: tab,
            isTabSelected: () => parentComponent.isTabSelected(tab)
          }
        : null
    },

    componentPath() {
      // Tabs add their name, as they don't appear in data paths.
      const { componentPath } = this.parentComponent
      return this.tab ? appendDataPath(componentPath, this.tab) : componentPath
    },

    // See `DitoTabs.getTabId()` and `getTabPanelId()`:
    tabId() {
      const { componentPath } = this.parentComponent
      return this.tab ? `${componentPath}-tab-${this.tab}` : null
    },

    tabPanelId() {
      const { componentPath } = this.parentComponent
      return this.tab ? `${componentPath}-tabpanel-${this.tab}` : null
    },

    componentSchemas() {
      // Compute a components list which has the dataPath baked into its keys
      // and adds the key as the name to each component, used for labels, etc.
      // NOTE: schema can be null while multi-form lists load their data,
      // because only the available data will determine the type of form.
      // The component of a value wrapped by an item adapter keeps the data
      // path of the item, which the errors of the value map to.
      const itemAdapter = getItemAdapter(this.sourceSchema)
      return Object.entries(this.schema?.components || {}).map(
        ([name, schema]) => {
          // Always add name to component schema, but clone it first to avoid
          // mutating the original schema potentially used in multiple places.
          schema = { ...schema, name }
          // Share dataPath and store with parent if not nested:
          const nested = hasNestedData(schema)
          const nestedDataPath = appendDataPath(this.dataPath, name)
          const dataPath =
            nested && name !== itemAdapter?.name
              ? nestedDataPath
              : this.dataPath
          return {
            schema,
            dataPath,
            nestedDataPath,
            nested,
            store: this.getChildStore(name),
            // The same as `DitoContainer.hasLabel`, also for type components
            // that render their own label, e.g. sections.
            hasLabel: hasLabel(schema, this.generateLabels)
          }
        }
      )
    },

    isSingleComponent() {
      return this.single && this.componentSchemas.length === 1
    },

    shouldRenderComponentByIndex() {
      return this.componentSchemas.map(({ schema, nested, dataPath }) =>
        this.shouldRenderComponent(schema, nested, dataPath)
      )
    },

    renderedPositions() {
      // Ignore the positions of containers that aren't rendered anymore, as
      // their removal doesn't necessarily resize the pane, see `onResizePane()`
      return this.positions.map((position, index) =>
        this.shouldRenderComponentByIndex[index] ? position : null
      )
    },

    verticalLabelsByIndices() {
      const positions = this.renderedPositions

      const isLastInRow = index => (
        positions[index] && (
          index === positions.length - 1 ||
          findNextPosition(index).top > positions[index].top
        )
      )

      const findNextPosition = index => {
        for (let i = index + 1; i < positions.length; i++) {
          if (positions[i]) return positions[i]
        }
        return 0
      }

      const rows = []
      let row = []
      for (let index = 0; index < positions.length; index++) {
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
        let hasLabelsInRow = false
        for (const index of row) {
          // Labels in compact schemas are displayed next to their components,
          // so only count labels of containers that are higher than one line.
          // TODO: Handle nested schemas, e.g. 'section' or 'object' and
          // detect labels there too.
          if (
            positions[index]?.height > 2 &&
            this.componentSchemas[index].hasLabel
          ) {
            hasLabelsInRow = true
            break
          }
        }
        for (const index of row) {
          verticalLabelsByIndices[index] = hasLabelsInRow
        }
      }

      return verticalLabelsByIndices
    }
  },

  watch: {
    'componentSchemas.length'(length) {
      this.positions.length = length
    }
  },

  methods: {
    shouldRenderComponent(schema, nested, dataPath) {
      // Evaluate the component's `if` before it is rendered, with its own
      // context, the same as once it is rendered, not with the pane's.
      return shouldRenderSchema(
        schema,
        DitoContext.createForSchema(this, {
          schema,
          name: schema.name,
          nested,
          data: this.data,
          dataPath,
          rootData: this.rootData
        })
      )
    },

    onResizePane() {
      this.$nextTick(() => {
        // The containers aren't rendered anymore if the pane was emptied or
        // unmounted in the meantime.
        for (const container of this.$refs.containers ?? []) {
          const node = container.$el
          const index = +node.dataset.index
          const bounds = node.getBoundingClientRect()
          const style = getComputedStyle(node)
          const padding = parseFloat(style.padding)
          const fontSize = parseFloat(style.fontSize)
          const height = bounds.height - 2 * padding
          this.positions[index] =
            height <= 0
              ? null
              : {
                  top: bounds.y,
                  height: height / fontSize
                }
        }
      })
    },

    isInLabeledRow(index) {
      return !!this.verticalLabelsByIndices[index]
    }
  }
})
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
