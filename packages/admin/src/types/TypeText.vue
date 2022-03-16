<template lang="pug">
  input-field.dito-text(
    ref="element"
    :id="dataPath"
    :type="inputType"
    v-model="inputValue"
    v-bind="attributes"
    v-on="listeners"
  )
</template>

<script>
import TypeComponent from '../TypeComponent.js'
import { InputField } from '@ditojs/ui'

const maskedPassword = '****************'

export default TypeComponent.register([
  'text', 'email', 'url', 'hostname', 'domain', 'tel', 'password', 'creditcard'
],
// @vue/component
{
  components: { InputField },
  nativeField: true,
  textField: true,
  ignoreMissingValue: schema => schema.type === 'password',

  computed: {
    inputType() {
      return {
        creditcard: 'text',
        hostname: 'text',
        domain: 'text'
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
    getValidations() {
      const rule = {
        email: 'email',
        url: 'url',
        hostname: 'hostname',
        domain: 'domain',
        password: 'password',
        creditcard: 'creditcard'
      }[this.type]
      return rule ? { [rule]: true } : {}
    }
  }
})
</script>
