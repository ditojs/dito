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
      position="prefix"
      v-bind="inputAffixesProps.prefix"
    )
  template(#suffix)
    DitoInputAffixes(
      position="suffix"
      v-bind="inputAffixesProps.suffix"
      @clear="clear"
    )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { numberDescriptor } from './descriptors.ts'
import NumberMixin from '../mixins/NumberMixin.js'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { getInputAffixesProps } from '../utils/affixes.js'
import { DitoInput } from '@ditojs/ui/src'

// @vue/component
const DitoTypeNumber = DitoTypeComponent.component('DitoTypeNumber', {
  mixins: [NumberMixin],
  components: { DitoInput, DitoInputAffixes },
  nativeField: true,
  textField: true,

  computed: {
    inputAffixesProps() {
      return getInputAffixesProps(this)
    },

    isInteger() {
      return this.type === 'integer'
    }
  }
})

defineType({
  types: ['number', 'integer'],
  component: DitoTypeNumber,
  ...numberDescriptor
})

export default DitoTypeNumber
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
