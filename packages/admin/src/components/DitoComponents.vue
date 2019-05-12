<template lang="pug">
  .dito-components(
    v-if="isPopulated && componentSchemas.length > 0"
    v-show="visible"
  )
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
</template>

<style lang="sass">
.dito
  .dito-components
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
  provide() {
    return {
      tabComponent: this.tabComponent
    }
  },

  props: {
    visible: { type: Boolean, default: true },
    tab: { type: String, default: null },
    schema: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: true }
  },

  computed: {
    tabComponent() {
      return this.tab ? this : null
    },

    componentSchemas() {
      // Compute a components list which has the dataPath baked into its keys
      // and adds the key as the name to each component, used for labels, etc.
      // NOTE: schema can be null while multi-form lists load their data,
      // because only the available data will determine the type of form.
      const { dataPath } = this
      // When editing primitive values through a form, do not append 'name' to
      // the component's dataPath so it can be mapped to from validation errors.
      // NOTE: Not all schemas / components have a sourceSchema, e.g. dialogs.
      const wrapPrimitives = this.sourceSchema?.wrapPrimitives
      return Object.entries(this.schema?.components || {}).map(
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
      return this.componentSchemas.reduce(
        (panels, { schema, dataPath }) => {
          const panel = getPanelSchema(schema, dataPath, this.schemaComponent)
          if (panel) {
            panels.push({
              ...panel,
              tabComponent: this.tabComponent
            })
          }
          return panels
        },
        []
      )
    }
  },

  created() {
    this._register(true)
  },

  destroyed() {
    this._register(false)
  },

  methods: {
    _register(add) {
      this.schemaComponent._registerComponentsContainer(this, add)
    },

    focus() {
      if (this.tab) {
        this.$router.push({ hash: this.tab })
      }
    }
  }
})
</script>
