<template lang="pug">
ul.dito-radio-buttons(
  :id="dataPath"
  :class="`dito-layout-${schema.layout || 'vertical'}`"
)
  li(
    v-for="option in options"
  )
    label
      input.dito-radio-button(
        ref="element"
        v-model="selectedValue"
        type="radio"
        :value="getValueForOption(option)"
        v-bind="attributes"
      )
      | {{ getLabelForOption(option) }}
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'

// @vue/component
export default DitoTypeComponent.register('radio', {
  mixins: [OptionsMixin],

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
