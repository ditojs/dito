// @vue/component
export default {
  data() {
    return {
      ownSchemaComponent: null
    }
  },

  computed: {
    errors() {
      return this.ownSchemaComponent?.errors || null
    },

    selectedTab() {
      return this.ownSchemaComponent?.selectedTab || null
    },

    isTouched() {
      return this.ownSchemaComponent?.isTouched || false
    },

    isDirty() {
      return this.ownSchemaComponent?.isDirty || false
    },

    isValid() {
      return this.ownSchemaComponent?.isValid || false
    },

    isValidated() {
      return this.ownSchemaComponent?.isValidated || false
    }
  },

  methods: {
    // This method is called by `DitoSchema.created()/destroyed()` on its
    // $parent, if the parent uses the `SchemaParentMixin`:
    _registerSchemaComponent(schemaComponent, add) {
      this.ownSchemaComponent = add ? schemaComponent : null
    }
  }
}
