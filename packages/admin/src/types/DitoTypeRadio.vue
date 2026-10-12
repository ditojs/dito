<template lang="pug">
DitoOptionList.dito-radio-buttons(
  :id="componentPath"
  role="radiogroup"
  :aria-label="label"
  :options="options"
  :isGrouped="!!groupBy"
  :layout="schema.layout"
)
  template(#option="{ option, isFirstOption }")
    label
      input.dito-radio-button(
        :ref="isFirstOption ? 'element' : undefined"
        v-model="selectedValue"
        type="radio"
        :value="getValueForOption(option)"
        v-bind="attributes"
      )
      | {{ getLabelForOption(option) }}
    DitoOptionsEditButtons(
      v-if="editable"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :store="store"
      :optionValue="getValueForOption(option)"
    )
</template>

<script>
import { defineType } from '../utils/schema/types.ts'
import { optionsTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useOptions } from '../composables/useOptions.ts'
import DitoOptionList from '../components/DitoOptionList.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'

// @vue/component
const DitoTypeRadio = {
  name: 'DitoTypeRadio',
  components: { DitoOptionList, DitoOptionsEditButtons },
  props: fieldProps,

  setup(props) {
    const field = useField(props, { nativeField: true })
    return { ...field, ...useOptions(props, field) }
  }
}

defineType({
  types: ['radio'],
  component: DitoTypeRadio,
  ...optionsTraits,
  defaultWidth: 'auto'
})

export default DitoTypeRadio
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-radio-buttons {
  label {
    @extend %input-borderless;
  }

  .dito-radio-button {
    margin-right: $form-spacing;
  }
}
</style>
