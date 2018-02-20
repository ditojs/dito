<template lang="pug">
  input.dito-text.dito-input(
    ref="element"
    :id="dataPath"
    :name="dataPath"
    :type="type"
    :title="label"
    v-model="textValue"
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
  'text', 'email', 'url', 'tel', 'password'
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

    textValue: {
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
    defaultValue() {
      // Use `undefined` to indicate that a fake password should be displayed as
      // a placeholder, '' to display an empty field.
      return this.isPassword ? undefined : ''
    }
  }
})
</script>
