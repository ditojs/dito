<template lang="pug">
  ul.dito-radio-buttons(
    :id="dataPath"
    :class="`dito-layout-${schema.layout || 'vertical'}`"
  )
    li(v-for="option in options")
      label
        input.dito-radio-button(
          type="radio"
          :value="getValueForOption(option)"
          v-model="selectValue"
          v-validate="validations"
          v-bind="getAttributes()"
          v-on="getEvents()"
        )
        | {{ getLabelForOption(option) }}
</template>

<style lang="sass">
.dito
  .dito-radio-buttons
    .dito-radio-button
      margin-right: $form-spacing
</style>

<script>
import TypeComponent from '@/TypeComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

export default TypeComponent.register('radio', {
  mixins: [OptionsMixin],

  nativeField: true
})
</script>
