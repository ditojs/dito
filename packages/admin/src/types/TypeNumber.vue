<template lang="pug">
  input.dito-number.dito-input(
    ref="element"
    :id="dataPath"
    :name="dataPath"
    type="number"
    :title="label"
    v-model="numberValue"
    v-validate="validations"
    :data-vv-as="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
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

export default TypeComponent.register('number', {
  computed: {
    numberValue: {
      get() {
        return this.value !== null ? this.value : ''
      },

      set(value) {
        this.value = value !== '' ? parseFloat(value) : null
      }
    }
  }
})
</script>
