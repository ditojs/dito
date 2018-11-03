<template lang="pug">
  input-field.dito-text(
    ref="element"
    :id="dataPath"
    :type="inputType"
    v-model="inputValue"
    v-validate="validations"
    v-bind="attributes"
    v-on="listeners"
  )
</template>

<script>
import DitoTypeComponent from '@/DitoTypeComponent'
import { InputField } from '@ditojs/ui'
import { asArray } from '@ditojs/utils'

const maskedPassword = '****************'

export default DitoTypeComponent.register([
  'text', 'email', 'url', 'hostname', 'tel', 'password', 'creditcard'
],
// @vue/component
{
  components: { InputField },
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
    }
  },

  methods: {
    getValidationRules() {
      const rules = {}
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
      return rules
    }
  }
})
</script>
