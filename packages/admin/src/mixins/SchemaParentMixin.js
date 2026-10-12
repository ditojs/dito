// @vue/component
export default {
  provide() {
    return {
      $schemaParentComponent: () => this
    }
  },

  data() {
    return {
      schemaComponents: []
    }
  },

  computed: {
    mainSchemaComponent() {
      return this.schemaComponents[0]
    },

    // @overridable
    // The schema of the source whose item the schemas of the component
    // display: Sources, views and forms tell their own, sections and panels
    // the one of their schema component, dialogs have none.
    sourceSchema() {
      return this.schemaComponent?.sourceSchema ?? null
    }
  },

  methods: {
    // This method is called by `DitoSchema.created()/unmounted()` on its
    // `$schemaParentComponent`, if the parent uses the `SchemaParentMixin`:
    _registerSchemaComponent(schemaComponent, add) {
      const { schemaComponents } = this
      if (add) {
        schemaComponents.push(schemaComponent)
      } else {
        const index = schemaComponents.indexOf(schemaComponent)
        if (index >= 0) {
          schemaComponents.splice(index, 1)
        }
      }
    }
  }
}
