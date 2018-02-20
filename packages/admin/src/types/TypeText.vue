<template lang="pug">
  input.dito-text.dito-input(
    ref="element"
    :id="dataPath"
    :name="dataPath"
    :type="inputType"
    :title="label"
    v-model="inputValue"
    @focus="focused = true"
    @blur="focused = false"
    v-validate="validations"
    :data-vv-as="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

const maskedPassword = '****************'

export default TypeComponent.register([
  'text', 'email', 'url', 'tel', 'password', 'creditcard'
], {
  data() {
    return {
      focused: false
    }
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
  },

  methods: {
    defaultValue() {
      // Use `undefined` to indicate that a fake password should be displayed as
      // a placeholder, '' to display an empty field.
      return this.isPassword ? undefined : ''
    }
  }
})
</script>
