import { isFunction } from '@ditojs/utils'
import * as validations from '../validations/index.js'

// @vue/component
export default {
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
    events() {
      return {
        focus: () => {
          this.isTouched = true
        },
        blur: () => {
          this.validate()
        },
        change: () => {
          this.markDirty()
        },
        input: () => {
          this.markDirty()
        }
      }
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
      // console.log('validate', this.dataPath, value, this.validations)
      for (const [rule, setting] of Object.entries(this.validations)) {
        const validator = validations[rule]
        if (validator && (validator.nullish || value != null)) {
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
      for (const { message } of errors) {
        this.addError(message, true)
      }
      if (focus) {
        this.focus()
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
