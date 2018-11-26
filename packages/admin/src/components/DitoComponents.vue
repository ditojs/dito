<template lang="pug">
  .dito-components(
    v-if="componentSchemas"
  )
    .dito-components-container.dito-schema-content
      dito-component-container(
        v-for="(compSchema, compDataPath) in componentSchemas"
        v-if="shouldRender(compSchema)"
        :key="compDataPath"
        :schema="compSchema"
        :dataPath="compDataPath"
        :data="data"
        :meta="meta"
        :store="getChildStore(compSchema.name)"
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
import { getPanelSchema } from '@/utils/schema'

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
      const { dataPath, schema = {} } = this
      // When editing primitive values through a form, do not append 'value' to
      // the component's dataPath so it can be mapped to from validation errors.
      const wrapPrimitives = this.sourceSchema?.wrapPrimitives
      return Object.entries(schema.components || {}).reduce(
        (schemas, [name, component]) => {
          const path = wrapPrimitives
            ? dataPath
            : appendDataPath(dataPath, name)
          schemas[path] = {
            name,
            ...component
          }
          return schemas
        },
        {}
      )
    },

    panelSchemas() {
      // Gather all panel schemas from all component schemas, by finding those
      // that want to provide a panel. See `getPanelSchema()` for details.
      const panels = {}
      for (const [dataPath, schema] of Object.entries(this.componentSchemas)) {
        const panel = getPanelSchema(schema, dataPath, this.schemaComponent)
        if (panel) {
          // If the panel provides its own name, append it to the dataPath.
          // This is used for $filters panels.
          const path = panel.name
            ? appendDataPath(dataPath, panel.name)
            : dataPath
          panels[path] = panel
        }
      }
      return Object.keys(panels).length ? panels : null
    },

    hasPanels() {
      return !!this.panelSchemas
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
