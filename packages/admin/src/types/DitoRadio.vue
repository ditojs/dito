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
          :value="getOptionValue(option)"
          v-model="value"
          v-validate="validations"
          :disabled="disabled"
        )
        | {{ getOptionLabel(option) }}
</template>

<style lang="sass">
.dito
  .dito-radio-buttons
    .dito-radio-button
      margin-right: $form-spacing
</style>

<script>
import DitoComponent from '@/DitoComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

export default DitoComponent.register('radio', {
  mixins: [OptionsMixin]
})
</script>
