<template lang="pug">
  ul.dito-checkboxes(
    :id="name"
    :class="`dito-layout-${desc.layout || 'vertical'}`"
  )
    li(v-for="option in options")
      label
        input.dito-checkbox(
          :name="name"
          type="checkbox"
          v-model="data[name]"
          v-validate="validations"
          :disabled="disabled"
          :value="getValue(option)"
        )
        | {{ getLabel(option) }}
</template>

<style lang="sass">
.dito
  .dito-checkboxes
    .dito-checkbox
      margin-right: $form-spacing
</style>

<script>
import DitoComponent from '@/DitoComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

export default DitoComponent.register('checkboxes', {
  mixins: [OptionsMixin]
})
</script>
