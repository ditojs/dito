import { isFunction } from '@ditojs/utils'
import * as validators from '../validators/index.js'

// @vue/component
export default {
  emits: ['errors'],

  data() {
    return {
      isTouched: false,
      isDirty: false,
      isValidated: false,
      isValid: false,
      errors: null
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
      let isValid = true
      if (notify) {
        this.clearErrors()
      }
      const { value } = this
      for (const [rule, setting] of Object.entries(this.validations)) {
        // eslint-disable-next-line import/namespace
        const validator = validators[rule]
        if (
          validator &&
          // Only apply 'required' validator to empty values.
          // Apply all other validators only to non-empty values.
          (rule === 'required' || value != null && value !== '')
        ) {
          const { validate, message } = validator
          if (!validate(value, setting, this.validations)) {
            isValid = false
            if (notify) {
              const error = isFunction(message)
                ? message(value, setting, this)
                : message
              this.addError(error, true)
            }
          }
        }
      }
      if (notify) {
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
