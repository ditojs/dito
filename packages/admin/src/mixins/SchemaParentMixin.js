// @vue/component
export default {
  data() {
    return {
      schemaComponents: []
    }
  },

  provide() {
    return {
      $schemaParentComponent: () => this
    }
  },

  methods: {
    // This method is called by `DitoSchema.created()/destroyed()` on its
    // $parent, if the parent uses the `SchemaParentMixin`:
    _registerSchemaComponent(schemaComponent, add) {
      const { schemaComponents } = this
      if (add) {
        schemaComponents.push(schemaComponent)
      } else {
        schemaComponents.splice(schemaComponents.indexOf(schemaComponent), 1)
      }
    }
  }
}
