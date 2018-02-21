<template lang="pug">
  ul.dito-checkboxes(
    :id="dataPath"
    :class="`dito-layout-${schema.layout || 'vertical'}`"
  )
    li(v-for="option in options")
      label
        input.dito-checkbox(
          ref="element"
          :name="dataPath"
          type="checkbox"
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
  .dito-checkboxes
    .dito-checkbox
      margin-right: $form-spacing
</style>

<script>
import TypeComponent from '@/TypeComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

export default TypeComponent.register('checkboxes', {
  mixins: [OptionsMixin],

  methods: {
    defaultValue() {
      return []
    }
  }
})
</script>
