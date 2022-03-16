<template lang="pug">
  ul.dito-radio-buttons(
    :id="dataPath"
    :class="`dito-layout-${schema.layout || 'vertical'}`"
  )
    li(v-for="option in options")
      label
        input.dito-radio-button(
          ref="element"
          type="radio"
          :value="getValueForOption(option)"
          v-model="selectedValue"
          v-bind="attributes"
          v-on="listeners"
        )
        | {{ getLabelForOption(option) }}
</template>

<style lang="sass">
  .dito-radio-buttons
    label
      @extend %input-borderless
    .dito-radio-button
      margin-right: $form-spacing
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'

// @vue/component
export default TypeComponent.register('radio', {
  mixins: [OptionsMixin],

  nativeField: true
})
</script>
