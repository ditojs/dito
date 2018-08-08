<template lang="pug">
  input.dito-text.dito-input(
    ref="element"
    :id="dataPath"
    :type="inputType"
    v-model="inputValue"
    v-validate="validations"
    v-bind="attributes"
    v-on="events"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'
import { asArray } from '@ditojs/utils'

const maskedPassword = '****************'

export default TypeComponent.register([
  'text', 'email', 'url', 'hostname', 'tel', 'password', 'creditcard'
],
// @vue/component
{
  nativeField: true,
  textField: true,

  computed: {
    isPassword() {
      return this.type === 'password'
    },

    inputType() {
      return ['creditcard', 'hostname'].includes(this.type) ? 'text' : this.type
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
        url: ['url', 'require_protocol'],
        hostname: 'hostname',
        creditcard: 'credit_card'
      }[this.type]
      if (rule) {
        const [key, value] = asArray(rule)
        rules[key] = value
      }
      return { rules }
    }
  }
})
</script>
