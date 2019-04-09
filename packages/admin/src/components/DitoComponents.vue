<template lang="pug">
  .dito-components(
    v-if="hasComponents"
  )
    .dito-components-container.dito-schema-content
      dito-component-container(
        v-for="{ schema, dataPath, store } in componentSchemas"
        v-if="shouldRender(schema)"
        :key="dataPath"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :disabled="disabled"
        :generateLabels="generateLabels"
      )
    // If showPanels is true it means that any tab or main components has panels
    // and all other should render .dito-panels as well for proper layout.
    dito-panels(
      v-if="showPanels"
      :panels="panelSchemas"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
</template>

<style lang="sass">
.dito
  .dito-components
    display: flex
    .dito-panels
      flex: auto
    .dito-components-container
      // Remove padding added by .dito-component-container below
      margin: (-$form-spacing) (-$form-spacing-half)
      // Add removed horizontal margin again to max-width:
      max-width: $content-width + 2 * $form-spacing-half
      display: flex
      flex-flow: row wrap
      flex: 100%
      position: relative
      align-items: baseline
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { appendDataPath } from '@/utils/data'
import { getTypeOptions, getPanelSchema } from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-components', {
  inject: ['$validator'],

  provide() {
    return {
      tabComponent: this.tab ? this : null
    }
  },

  props: {
    tab: { type: String, default: null },
    schema: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    showPanels: { type: Boolean, required: false },
    generateLabels: { type: Boolean, default: true }
  },

  computed: {
    componentSchemas() {
      // Compute a components list which has the dataPath baked into its keys
      // and adds the key as the name to each component, used for labels, etc.
      // NOTE: schema can be null while multi-form lists load their data,
      // because only the available data will determine the type of form.
      const { dataPath } = this
      // When editing primitive values through a form, do not append 'name' to
      // the component's dataPath so it can be mapped to from validation errors.
      const { wrapPrimitives } = this.sourceSchema
      return Object.entries(this.schema.components || {}).map(
        ([name, schema]) => {
          // Share dataPath and store with parent if flattenedType is true:
          const flattened = getTypeOptions(schema)?.flattenedType
          // Always add name to component schema
          schema.name = name
          return {
            schema,
            dataPath: flattened || wrapPrimitives
              ? dataPath
              : appendDataPath(dataPath, name),
            store: flattened ? this.store : this.getChildStore(name)
          }
        }
      )
    },

    panelSchemas() {
      // Gather all panel schemas from all component schemas, by finding those
      // that want to provide a panel. See `getPanelSchema()` for details.
      return (this.componentSchemas || []).reduce(
        (panels, { schema, dataPath }) => {
          const panel = getPanelSchema(schema, dataPath, this.schemaComponent)
          if (panel) {
            // If the panel provides its own name, append it to the dataPath.
            // This is used for $filters panels.
            panels.push({
              schema: panel,
              dataPath: panel.name
                ? appendDataPath(dataPath, panel.name)
                : dataPath
            })
          }
          return panels
        },
        []
      )
    },

    hasComponents() {
      return this.componentSchemas.length > 0
    },

    hasPanels() {
      return this.panelSchemas.length > 0
    }
  },

  methods: {
    focus() {
      if (this.tab) {
        this.$router.push({ hash: this.tab })
      }
    }
  }
})
</script>
