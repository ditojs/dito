<template lang="pug">
  input-field.dito-number(
    ref="element"
    :id="dataPath"
    type="number"
    v-model="inputValue"
    v-bind="attributes"
    v-on="listeners"
    :min="min"
    :max="max"
    :step="stepValue"
  )
</template>

<style lang="sass">
  // Only show spin buttons if the number component defines a step size.
  input[type="number"]:not([step])
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button
      -webkit-appearance: none
      margin: 0
</style>

<script>
import TypeComponent from '@/TypeComponent'
import NumberMixin from '@/mixins/NumberMixin'
import { InputField } from '@ditojs/ui'

export default TypeComponent.register([
  'number', 'integer'
],
// @vue/component
{
  components: { InputField },
  mixins: [NumberMixin],
  nativeField: true,
  textField: true,

  computed: {
    inputValue: {
      get() {
        return this.value !== null ? this.value : ''
      },

      set(value) {
        this.value = value !== ''
          ? this.isInteger ? parseInt(value, 10) : parseFloat(value)
          : null
      }
    },

    isInteger() {
      return this.type === 'integer'
    },

    stepValue() {
      return this.step == null && !this.isInteger ? 'any' : this.step
    }
  }
})
</script>
