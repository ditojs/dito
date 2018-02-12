<template lang="pug">
  ul.dito-radio-buttons(
    :id="name"
    :class="`dito-layout-${schema.layout || 'vertical'}`"
  )
    li(v-for="option in options")
      label
        input.dito-radio-button(
          :name="name"
          type="radio"
          :title="label"
          :value="optionToValue(option)"
          v-model="selectValue"
          v-validate="validations"
          :data-vv-as="label"
          :disabled="disabled"
        )
        | {{ optionToLabel(option) }}
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
