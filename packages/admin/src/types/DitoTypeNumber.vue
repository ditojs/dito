<template lang="pug">
DitoInput.dito-number(
  :id="componentPath"
  ref="element"
  v-model="inputValue"
  type="number"
  v-bind="attributes"
  :min="min"
  :max="max"
  :step="stepValue"
)
  template(#prefix)
    DitoInputAffixes(
      :typeComponent="this"
      position="prefix"
    )
  template(#suffix)
    DitoInputAffixes(
      :typeComponent="this"
      position="suffix"
    )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { DitoInput } from '@ditojs/ui/src'

export default DitoTypeComponent.register(
  ['number', 'integer'],
  // @vue/component
  {
    mixins: [NumberMixin],
    components: { DitoInput, DitoInputAffixes },
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
.dito-number input[type='number']:not([step]) {
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}
</style>
