<template lang="pug">
  ul.dito-checkboxes(
    :id="dataPath"
    :class="`dito-layout-${schema.layout || 'vertical'}`"
  )
    li(v-for="option in options")
      label
        input.dito-checkbox(
          ref="element"
          type="checkbox"
          :value="getValueForOption(option)"
          v-model="selectValue"
          v-validate="validations"
          v-bind="attributes"
          v-on="listeners"
        )
        | {{ getLabelForOption(option) }}
</template>

<style lang="sass">
.dito
  .dito-checkboxes
    .dito-checkbox
      margin-right: $form-spacing
</style>

<script>
import DitoTypeComponent from '@/DitoTypeComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

// @vue/component
export default DitoTypeComponent.register('checkboxes', {
  mixins: [OptionsMixin],

  nativeField: true,
  defaultValue: []
})
</script>
