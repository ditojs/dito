import SchemaParentMixin from './SchemaParentMixin.js'

// @vue/component
export default {
  mixins: [SchemaParentMixin],

  computed: {
    errors() {
      return this.schemaComponents.reduce(
        (result, { errors }) =>
          errors && result ? result.concat(errors) : errors,
        null
      )
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

    showValidationErrors(errors, focus) {
      this.schemaComponents.forEach(
        it => it.showValidationErrors(errors, focus)
      )
    }
  }
}
