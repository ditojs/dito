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
import TypeComponent from '../TypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'

// @vue/component
export default TypeComponent.register('radio', {
  mixins: [OptionsMixin],

  nativeField: true
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
