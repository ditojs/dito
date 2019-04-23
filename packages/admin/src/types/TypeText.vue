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
import TypeComponent from '@/TypeComponent'
import { InputField } from '@ditojs/ui'

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
    },

    validations() {
      const rule = {
        email: 'email',
        url: 'url',
        hostname: 'hostname',
        creditcard: 'creditcard'
      }[this.type]
      return rule ? { [rule]: true } : {}
    }
  }
})
</script>
