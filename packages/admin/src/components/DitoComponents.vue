<template lang="pug">
  .dito-components(
    v-if="isPopulated && componentSchemas.length > 0"
    v-show="visible"
  )
    dito-component-container(
      v-for="{ schema, dataPath, flattenedDataPath, store } in componentSchemas"
      v-if="shouldRender(schema)"
      :key="dataPath"
      :schema="schema"
      :dataPath="flattenedDataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :single="isSingleComponent"
      :disabled="disabled"
      :generateLabels="generateLabels"
    )
</template>

<style lang="sass">
  .dito-components
    display: flex
    flex-flow: row wrap
    align-content: flex-start
    // Use `flex: 0%` for all `.dito-components` except `.dito-components-main`,
    // so that the `.dito-buttons-main` can be moved all the way to the bottom.
    flex: 0%
    &.dito-components-main
      flex: 100%
    position: relative
    align-items: baseline
    // Remove padding added by .dito-component-container
    margin: (-$form-spacing) (-$form-spacing-half)
    // Add removed horizontal margin again to max-width:
    max-width: $content-width + 2 * $form-spacing-half
    .dito-component-container.dito-omit-padding > &
      // Clear above paddings again if parent is omitting padding.
      margin: 0
      max-width: unset
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { appendDataPath } from '@/utils/data'
import { getTypeOptions, getPanelSchema, getPanelSchemas } from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-components', {
  provide() {
    return {
      tabComponent: this.tabComponent
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
      // When editing primitive values through a form, do not append 'name' to
      // the component's dataPath so it can be mapped to from validation errors.
      // NOTE: Not all schemas / components have a sourceSchema, e.g. dialogs.
      const wrapPrimitives = this.sourceSchema?.wrapPrimitives
      return Object.entries(this.schema?.components || {}).map(
        ([name, schema]) => {
          // Share dataPath and store with parent if flattenedType is true:
          const flattened = getTypeOptions(schema)?.flattenedType
          // Always add name to component schema.
          schema.name = name
          const dataPath = appendDataPath(this.dataPath, name)
          return {
            schema,
            dataPath,
            flattenedDataPath: flattened || wrapPrimitives
              ? this.dataPath
              : dataPath,
            store: flattened ? this.store : this.getChildStore(name)
          }
        }
      )
    },

    panelSchemas() {
      // Gather all panel schemas from all component schemas, by finding those
      // that want to provide a panel. See `getPanelSchema()` for details.
      return this.componentSchemas.reduce(
        (schemas, { schema, dataPath }) => {
          for (const panel of [
            getPanelSchema(schema, dataPath, this.schemaComponent),
            // Allow each component to provide its own set of panels, in
            // addition to the default one (e.g. $filter):
            ...getPanelSchemas(schema.panels, dataPath, this.schemaComponent)
          ]) {
            if (panel) {
              schemas.push({
                ...panel,
                tabComponent: this.tabComponent
              })
            }
          }
          return schemas
        },
        []
      )
    },

    isSingleComponent() {
      return this.single && this.componentSchemas.length === 1
    }
  },

  created() {
    this._register(true)
  },

  beforeDestroy() {
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
