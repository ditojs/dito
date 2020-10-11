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
