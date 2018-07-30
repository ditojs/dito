<template lang="pug">
  input.dito-number.dito-input(
    ref="element"
    :id="dataPath"
    type="number"
    v-model="inputValue"
    v-validate="validations"
    v-bind="attributes"
    v-on="events"
    :min="min"
    :max="max"
    :step="step"
  )
</template>

<style lang="sass">
.dito
  // Only show spin buttons if the number component defines a step size.
  input[type="number"]:not([step])
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button
      -webkit-appearance: none
      margin: 0
</style>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register([
  'number', 'integer'
], {
  nativeField: true,
  textField: true,

  computed: {
    isInteger() {
      return this.type === 'integer'
    },

    inputValue: {
      get() {
        return this.value !== null ? this.value : ''
      },

      set(value) {
        this.value = value !== ''
          ? this.isInteger ? parseInt(value, 10) : parseFloat(value)
          : null
      }
    }
  }
})
</script>
