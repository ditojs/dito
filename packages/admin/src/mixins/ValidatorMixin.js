import SchemaParentMixin from './SchemaParentMixin.js'

// @vue/component
export default {
  mixins: [SchemaParentMixin],

  computed: {
    errors() {
      return this.schemaComponents.flatMap(({ errors }) => errors || [])
    },

    isTouched() {
      return this.schemaComponents.some(it => it.isTouched)
    },

    isDirty() {
      return this.schemaComponents.some(it => it.isDirty)
    },

    isValid() {
      return this.schemaComponents.every(it => it.isValid)
    },

    isValidated() {
      return this.schemaComponents.every(it => it.isValid)
    }
  },

  methods: {
    validateAll(match, notify = true) {
      return this.schemaComponents.every(it => it.validateAll(match, notify))
    },

    verifyAll(match) {
      return this.schemaComponents.every(it => it.verifyAll(match))
    },

    resetValidation() {
      this.schemaComponents.forEach(it => it.resetValidation())
    },

    clearErrors() {
      this.schemaComponents.forEach(it => it.clearErrors())
    },

    showValidationErrors(errors, focus, first = true) {
      this.schemaComponents.forEach(
        schemaComponent => {
          if (schemaComponent.showValidationErrors(errors, focus, first)) {
            first = false
          }
        }
      )
      return !first
    }
  }
}
