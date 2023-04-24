<!-- eslint-disable vue/no-template-shadow -->
<template lang="pug">
.dito-pane(
  v-if="isPopulated && componentSchemas.length > 0"
  v-show="visible"
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
    } in componentSchemas`
  )
    .dito-break(
      v-if="schema.break === 'before'"
    )
    DitoContainer(
      v-if="shouldRender(schema)"
      :key="nestedDataPath"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :single="isSingleComponent"
      :nested="nested"
      :disabled="disabled"
      :generateLabels="generateLabels"
    )
    .dito-break(
      v-if="schema.break === 'after'"
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { appendDataPath } from '../utils/data.js'
import { getAllPanelEntries, isNested } from '../utils/schema.js'

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
    visible: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
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
            store: nested ? this.getChildStore(name) : this.store
          }
        }
      )
    },

    panelEntries() {
      // Gather all panel schemas from all component schemas, by finding those
      // that want to provide a panel. See `getAllPanelEntries()` for details.
      return this.componentSchemas.flatMap(
        ({ schema, nestedDataPath: dataPath }) =>
          getAllPanelEntries(
            this.api,
            schema,
            dataPath,
            this.schemaComponent,
            this.tabComponent
          )
      )
    },

    isSingleComponent() {
      return this.single && this.componentSchemas.length === 1
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
        this.$router.push({ hash: `#${this.tab}` })
      }
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-pane {
  $max-width: $content-width + 2 * $content-padding;

  display: flex;
  position: relative;
  flex-flow: row wrap;
  align-content: flex-start;
  align-items: baseline;
  padding: $content-padding;
  // Remove the padding added by `.dito-container` inside `.dito-pane`:
  margin: (-$form-spacing) (-$form-spacing-half);
  // Add removed horizontal margin again to max-width:
  max-width: $max-width + 2 * $form-spacing-half;
  // Use `flex: 0%` for all `.dito-pane` except `.dito-pane-main`,
  // so that the `.dito-buttons-main` can be moved all the way to the bottom.
  flex: 0%;

  &--single {
    // Clear settings from above.
    margin: 0;
    max-width: $max-width;
  }

  &.dito-pane-main {
    flex: 100%;
    margin-bottom: 0; // For vertical scroll size.
  }

  .dito-schema-header:not(.dito-schema-menu-header) + & {
    // Clear top-margin if the components are preceded by a schema header.
    margin-top: 0;
  }

  .dito-container--omit-padding > & {
    // Clear margins set above again if parent is omitting padding.
    margin: 0;
    max-width: unset;
  }

  .dito-break {
    flex: 100%;
    height: 0;
  }
}
</style>
