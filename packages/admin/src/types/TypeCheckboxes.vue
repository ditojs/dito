<template lang="pug">
  ul.dito-checkboxes(
    :id="name"
    :class="`dito-layout-${schema.layout || 'vertical'}`"
  )
    li(v-for="option in options")
      label
        input.dito-checkbox(
          :name="name"
          type="checkbox"
          :title="label"
          :value="getOptionValue(option)"
          v-model="value"
          v-validate="validations"
          :data-vv-as="label"
          :disabled="disabled"
        )
        | {{ getOptionLabel(option) }}
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
