<!-- eslint-disable vue/no-template-shadow -->
<template lang="pug">
.dito-pane(
  v-if="isPopulated && componentSchemas.length > 0"
  :class=`{
    'dito-pane--single': isSingleComponent
  }`
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
    .dito-break(
      v-if="schema.break === 'before'"
    )
    DitoContainer(
      v-if="shouldRenderSchema(schema)"
      :key="nestedDataPath"
      v-resize="event => onResizeContainer(index, event)"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :single="isSingleComponent"
      :nested="nested"
      :disabled="disabled"
      :generateLabels="generateLabels"
      :verticalLabels="isInLabeledRow(index)"
      :accumulatedBasis="accumulatedBasis"
    )
    .dito-break(
      v-if="schema.break === 'after'"
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { appendDataPath } from '../utils/data.js'
import { isNested } from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('DitoPane', {
  provide() {
    return {
      $tabComponent: () => this.tabComponent
    }
  },

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    tab: { type: String, default: null },
    single: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false },
    accumulatedBasis: { type: Number, default: null }
  },

  data() {
    return {
      positions: []
    }
  },

  computed: {
    tabComponent() {
      return this.tab ? this : this.$tabComponent()
    },

    componentSchemas() {
      // Compute a components list which has the dataPath baked into its keys
      // and adds the key as the name to each component, used for labels, etc.
      // NOTE: schema can be null while multi-form lists load their data,
      // because only the available data will determine the type of form.
      // When editing primitive values through a form, do not append 'name' to
      // the component's dataPath so it can be mapped to from validation errors.
      // NOTE: Not all schemas / components have a sourceSchema, e.g. dialogs.
      const wrapPrimitives = this.sourceSchema?.wrapPrimitives
      return Object.entries(this.schema?.components || {}).map(
        ([name, schema]) => {
          // Always add name to component schema.
          schema.name = name
          // Share dataPath and store with parent if not nested:
          const nested = isNested(schema)
          const nestedDataPath = appendDataPath(this.dataPath, name)
          return {
            schema,
            dataPath:
              nested && !wrapPrimitives
                ? nestedDataPath
                : this.dataPath,
            nestedDataPath,
            nested,
            store: this.getChildStore(name)
          }
        }
      )
    },

    isSingleComponent() {
      return this.single && this.componentSchemas.length === 1
    },

    verticalLabelsByIndices() {
      const { positions } = this

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
          const position = this.positions[index]
          if (
            position?.height > 2 &&
            position.node.querySelector(':scope > .dito-label')
          ) {
            // TODO: Handle nested schemas, e.g. 'section' or 'object' and
            // detect labels there too.
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

  created() {
    this._register(true)
  },

  unmounted() {
    this._register(false)
  },

  methods: {
    _register(add) {
      this.schemaComponent._registerPane(this, add)
    },

    focus() {
      if (this.tab) {
        return this.$router.push({ hash: `#${this.tab}` })
      }
    },

    onResizeContainer(index, { target, contentRect: { width, height } }) {
      this.positions[index] =
        width > 0 && height > 0
          ? {
              top: target.getBoundingClientRect().y,
              height: height / parseFloat(getComputedStyle(target).fontSize),
              node: target
            }
          : null
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

  display: flex;
  position: relative;
  flex-flow: row wrap;
  align-items: flex-start;
  align-content: flex-start;
  // Remove the padding added by `.dito-container` inside `.dito-pane`:
  margin: (-$form-spacing) (-$form-spacing-half);
  // Use `flex: 0%` for all `.dito-pane` except `.dito-pane__main`,
  // so that the `.dito-buttons-main` can be moved all the way to the bottom.
  flex: 0%;

  &__main {
    flex: 100%;
  }

  .dito-scroll > & {
    // A root-level pane inside a scroll view. Clear negative margin from above.
    margin: 0;
    // Move the negative margin used to remove the padding added by
    // `.dito-container` inside `.dito-pane` to the padding:
    padding: ($content-padding - $form-spacing)
      ($content-padding - $form-spacing-half);

    &#{$self}--single {
      padding: $content-padding;
    }
  }

  // Display a ruler between tabbed components and towards the .dito-buttons
  &__tab + &__main {
    &::before {
      // Use a pseudo element to display a ruler with proper margins
      display: block;
      content: '';
      width: 100%;
      border-bottom: $border-style;
      // Add removed $form-spacing again to the ruler
      margin: (-$content-padding + $form-spacing) $form-spacing-half
        $form-spacing-half;
    }
  }

  &__main + .dito-buttons-main {
    // Needed forms with sticky main buttons.
    margin: $content-padding;
    margin-bottom: 0;
  }

  .dito-break {
    flex: 100%;
    height: 0;
  }
}
</style>
