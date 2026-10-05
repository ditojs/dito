import { getValueValidationErrors } from '../utils/schema/validation.js'

// @vue/component
export default {
  emits: ['errors'],

  data() {
    return {
      isTouched: false,
      isDirty: false,
      isValidated: false,
      isValid: false,
      errors: null,
      // The value that the displayed errors were added for, see `addError()`.
      valueWithErrors: undefined
    }
  },

  computed: {
    hasErrors() {
      return !!this.errors
    }
  },

  methods: {
    resetValidation() {
      this.isTouched = false
      this.isDirty = false
      this.isValidated = false
      this.isValid = false
      this.clearErrors()
    },

    validate(notify = true) {
      const errors = getValueValidationErrors(this.value, this.validations)
      const isValid = errors.length === 0
      if (notify) {
        this.clearErrors()
        for (const { message } of errors) {
          this.addError(message, true)
        }
        this.isValidated = true
        this.isValid = isValid
      }
      return isValid
    },

    verify() {
      return this.validate(false)
    },

    markTouched() {
      this.isTouched = true
      // Clear currently displayed errors when focusing input.
      this.clearErrors()
    },

    markDirty() {
      this.isDirty = true
      this.isValidated = false
      this.isValid = false
      // Clear currently displayed errors on new input.
      this.clearErrors()
    },

    addError(error, addLabel = false) {
      this.errors ||= []
      this.valueWithErrors = this.value
      if (addLabel) {
        const label = this.label || this.placeholder || this.name
        error = `The ${label} field ${error}.`
      }
      this.errors.push(error)
      this.$emit('errors', this.errors)
    },

    showValidationErrors(errors, focus) {
      // Convert from AJV errors objects to an array of error messages
      this.errors = []
      if (errors.length === 0) {
        return false
      }
      for (const { message } of errors) {
        this.addError(message, true)
      }
      if (focus) {
        this.scrollIntoView()
      }
      return true
    },

    getErrors() {
      return this.errors ? [...this.errors] : null
    },

    clearErrors() {
      this.errors = null
      this.$emit('errors', this.errors)
    }
  }
}
