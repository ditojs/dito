<template lang="pug">
  input.dito-number.dito-input(
    :id="name"
    :name="name"
    type="number"
    v-model="numberValue"
    v-validate="validations"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
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
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('number', {
  computed: {
    // As StrongLoop sents strings instead of numbers for decimals, use a
    // converting computed property to make sure we're dealing with numbers.
    numberValue: {
      get() {
        const value = this.value
        return value != null ? +value : value
      },
      set(value) {
        this.value = value
      }
    }
  }
})
</script>
