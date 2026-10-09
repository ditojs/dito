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
      :typeComponent="this"
      :optionValue="getValueForOption(option)"
    )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'
import DitoOptionList from '../components/DitoOptionList.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'

// @vue/component
export default DitoTypeComponent.register('radio', {
  mixins: [OptionsMixin],
  components: { DitoOptionList, DitoOptionsEditButtons },

  nativeField: true,
  defaultWidth: 'auto'
})
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
