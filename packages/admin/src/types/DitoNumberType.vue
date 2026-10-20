<template lang="pug">
DitoInput.dito-number(
  :id="componentPath"
  ref="element"
  v-model="inputValue"
  type="number"
  v-bind="attributes"
  :min="settings.minimum"
  :max="settings.maximum"
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
import { defineType } from '../utils/schema/types.ts'
import { numberTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useNumber } from '../composables/useNumber.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { DitoInput } from '@ditojs/ui/src'

// @vue/component
const DitoNumberType = {
  components: { DitoInput, DitoInputAffixes },
  props: fieldProps,

  setup(props) {
    const field = useField(props, { nativeField: true, textField: true })
    return { ...field, ...useNumber(props, field) }
  }
}

defineType({
  type: ['number', 'integer'],
  component: DitoNumberType,
  ...numberTraits
})

export default DitoNumberType
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
