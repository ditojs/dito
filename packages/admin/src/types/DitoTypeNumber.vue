<template lang="pug">
InputField.dito-number(
  :id="dataPath"
  ref="element"
  v-model="inputValue"
  type="number"
  v-bind="attributes"
  :min="min"
  :max="max"
  :step="stepValue"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'
import { InputField } from '@ditojs/ui/src'

export default DitoTypeComponent.register(
  ['number', 'integer'],
  // @vue/component
  {
    mixins: [NumberMixin],
    components: { InputField },
    nativeField: true,
    textField: true,

    computed: {
      isInteger() {
        return this.type === 'integer'
      }
    }
  }
)
</script>

<style lang="scss">
// Only show spin buttons if the number component defines a step size.
input[type='number']:not([step]) {
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}
</style>
