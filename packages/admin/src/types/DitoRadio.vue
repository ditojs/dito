<template lang="pug">
  ul.dito-radio-buttons(
    :id="name",
    :class="`dito-${desc.horizontal ? 'horizontal' : 'table'}`"
  )
    li(v-for="option in options")
      label
        input.dito-radio-button(
          :name="name",
          type="radio",
          v-model="data[name]",
          v-validate="validations",
          :disabled="disabled",
          :value="getValue(option)"
        )
        | {{ getLabel(option) }}
</template>

<style lang="sass">
.dito
  .dito-radio-buttons
    .dito-radio-button
      margin-right: 0.5em
</style>

<script>
import DitoComponent from '@/DitoComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

export default DitoComponent.register('radio', {
  mixins: [OptionsMixin]
})
</script>
