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
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { optionsDescriptor } from './descriptors.ts'
import OptionsMixin from '../mixins/OptionsMixin.js'
import DitoOptionList from '../components/DitoOptionList.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'

// @vue/component
const DitoTypeRadio = DitoTypeComponent.component('DitoTypeRadio', {
  mixins: [OptionsMixin],
  components: { DitoOptionList, DitoOptionsEditButtons },
  nativeField: true
})

defineType({
  types: ['radio'],
  component: DitoTypeRadio,
  ...optionsDescriptor,
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
