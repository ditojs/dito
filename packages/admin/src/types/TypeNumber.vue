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
import TypeComponent from '../TypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'
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
    isInteger() {
      return this.type === 'integer'
    }
  }
})
</script>
