<template lang="pug">
  ul.dito-radio-buttons(
    :id="dataPath"
    :class="`dito-layout-${schema.layout || 'vertical'}`"
  )
    li(v-for="option in options")
      label
        input.dito-radio-button(
          ref="element"
          :name="dataPath"
          type="radio"
          :title="label"
          :value="getValueForOption(option)"
          v-model="selectValue"
          v-validate="validations"
          :data-vv-as="label"
          :disabled="disabled"
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
  mixins: [OptionsMixin]
})
</script>
