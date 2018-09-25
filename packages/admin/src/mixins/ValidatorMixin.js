import { isFunction, isRegExp, isArray } from '@ditojs/utils'

// @vue/component
export default {
  computed: {
    isDirty() {
      return Object.keys(this.$fields).some(key => this.$fields[key].dirty)
    }
  },

  methods: {
    getErrors() {
      return this.$errors.collect()
    },

    clearErrors() {
      this.$errors.clear()
    },

    addError(dataPath, message) {
      this.$errors.add({
        field: dataPath,
        msg: message
      })
    },

    addErrors(errors) {
      for (const [dataPath, messages] of Object.entries(errors)) {
        for (const message of messages) {
          this.addError(dataPath, message)
        }
      }
    },

    setErrors(errors) {
      this.clearErrors()
      this.addErrors(errors)
    },

    async validateAll(match) {
      let fields
      if (match) {
        const check = isFunction(match)
          ? match
          : isRegExp(match)
            ? field => match.test(field)
            : null
        fields = check
          ? Object.keys(this.$fields).filter(check)
          : isArray(match)
            ? match
            : [match]
      }
      return this.$validator.validateAll(fields)
    },

    async verifyAll(match) {
      // There is no direct way to do this in vee-validate unfortunately:
      // So we store the previously set errors, run a full validation and
      // restore the previous errors after.
      const errors = this.getErrors()
      const valid = await this.validateAll(match, true)
      this.setErrors(errors)
      return valid
    }
  }
}
