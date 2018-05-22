<template lang="pug">
  input.dito-text.dito-input(
    :id="dataPath"
    :type="inputType"
    v-model="inputValue"
    v-validate="validations"
    v-bind="getAttributes()"
    v-on="getEvents()"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

const maskedPassword = '****************'

export default TypeComponent.register([
  'text', 'email', 'url', 'tel', 'password', 'creditcard'
], {
  nativeField: true,
  textField: true,

  defaultValue() {
    return ''
  },

  computed: {
    isPassword() {
      return this.type === 'password'
    },

    inputType() {
      return this.type === 'creditcard' ? 'text' : this.type
    },

    inputValue: {
      get() {
        return this.isPassword && this.value === undefined && !this.focused
          ? maskedPassword
          : this.value
      },

      set(value) {
        this.value = value
      }
    },

    validations() {
      const rules = this.getValidationRules()
      const rule = {
        email: 'email',
        url: 'url',
        creditcard: 'credit_card'
      }[this.type]
      if (rule) {
        rules[rule] = true
      }
      return { rules }
    }
  }
})
</script>
