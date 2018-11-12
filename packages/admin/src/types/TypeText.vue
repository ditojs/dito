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
import TypeComponent from '@/TypeComponent'
import { InputField } from '@ditojs/ui'
import { asArray } from '@ditojs/utils'

const maskedPassword = '****************'

export default TypeComponent.register([
  'text', 'email', 'url', 'hostname', 'tel', 'password', 'creditcard'
],
// @vue/component
{
  components: { InputField },
  nativeField: true,
  textField: true,

  computed: {
    inputType() {
      return {
        creditcard: 'text',
        hostname: 'text'
      }[this.type] || this.type
    },

    inputValue: {
      get() {
        return (
          this.type === 'password' &&
          this.value === undefined &&
          !this.focused
        )
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
      const rule = {
        email: 'email',
        url: ['url', 'require_protocol'],
        hostname: 'hostname',
        creditcard: 'credit_card'
      }[this.type]
      const rules = {}
      if (rule) {
        // Some rules simply need to be set (e.g. to undefined), other needs
        // a config value, e.g. `url: 'require_protocol'`, see above.
        const [key, value] = asArray(rule)
        rules[key] = value
      }
      return rules
    }
  }
})
</script>
