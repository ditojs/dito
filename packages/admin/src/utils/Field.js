import { isFunction } from '@ditojs/utils'
import * as validations from '../validations'

export default class Field {
  constructor(component) {
    this.component = component
    this.dataPath = component.dataPath
    this.label = component.label || component.placeholder || component.name
    // this.dataProcessor = component.mergedDataProcessor
    // this.validations = component.mergedValidations
    // Events to be installed / removed on the component, to handle state
    this.events = {
      focus: () => {
        this.isTouched = true
      },

      input: () => {
        this.isDirty = true
        this.isValidated = false
        this.isValid = false
        // Clear currently displayed errors on new input.
        this.errors = null
      }
    }
    this.reset()
  }

  get dataProcessor() {
    // TODO: Test this!
    return this.component.mergedDataProcessor
  }

  get validations() {
    // TODO: Test this!
    return this.component.mergedValidations
  }

  reset() {
    this.isTouched = false
    this.isDirty = false
    this.isValidated = false
    this.isValid = false
    this.errors = null
  }

  focus() {
    this.component.focus()
  }

  async validate(value, notify) {
    let isValid = true
    const errors = []
    for (const [rule, setting] of Object.entries(this.validations)) {
      const validator = validations[rule]
      if (validator) {
        const { validate, message } = validator
        if (!(await validate(value, setting))) {
          isValid = false
          if (notify) {
            errors.push(
              isFunction(message)
                ? message(value, setting, this)
                : message
            )
          }
        }
      }
    }
    if (notify) {
      this.isValidated = true
      this.isValid = isValid
      this.errors = isValid ? null : errors
    }
    return isValid
  }

  showValidationErrors(errors, focus) {
    // Convert from AJV errors objects to an array of error messages
    this.errors = errors.map(({ message }) => message)
    if (focus) {
      this.focus()
    }
    return true
  }

  getErrors() {
    return (
      this.errors?.map(error => `The ${this.label} field ${error}.`) ||
      null
    )
  }

  clearErrors() {
    this.errors = null
  }
}
