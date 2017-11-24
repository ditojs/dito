<template lang="pug">
  input.dito-text.dito-input(
    :id="name"
    :name="name"
    :type="type"
    :title="label"
    :value="value"
    @input="onInput"
    @focus="onFocus"
    @blur="onBlur"
    v-validate="validations"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

const maskedPassword = '****************'

export default TypeComponent.register([
  'text', 'email', 'url', 'tel', 'password'
], {
  computed: {
    isPassword() {
      return this.type === 'password'
    },

    default() {
      return this.isPassword ? maskedPassword : null
    }
  },

  methods: {
    onInput(event) {
      this.value = event.target.value
    },

    onFocus(event) {
      const { target } = event
      if (this.isPassword && target.value === maskedPassword) {
        target.value = ''
      }
    },

    onBlur(event) {
      const { target } = event
      if (this.isPassword && !target.value) {
        target.value = maskedPassword
      }
    }
  }
})
</script>
