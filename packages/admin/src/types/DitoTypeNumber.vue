<template lang="pug">
DitoInput.dito-number(
  :id="dataPath"
  ref="element"
  v-model="inputValue"
  type="number"
  v-bind="attributes"
  :min="min"
  :max="max"
  :step="stepValue"
)
  template(#prefix)
    DitoAffixes(
      :items="schema.prefix"
      position="prefix"
      mode="input"
      :disabled="disabled"
      :parentContext="context"
    )
  template(#suffix)
    DitoAffixes(
      :items="schema.suffix"
      position="suffix"
      mode="input"
      :clearable="showClearButton"
      :disabled="disabled"
      :inlineInfo="inlineInfo"
      :parentContext="context"
      @clear="clear"
    )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'
import DitoAffixes from '../components/DitoAffixes.vue'
import { DitoInput } from '@ditojs/ui/src'

export default DitoTypeComponent.register(
  ['number', 'integer'],
  // @vue/component
  {
    mixins: [NumberMixin],
    components: { DitoInput, DitoAffixes },
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
