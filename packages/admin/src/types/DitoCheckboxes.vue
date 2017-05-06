<template lang="pug">
  ul.dito-checkboxes(
    :id="name",
    :class="`dito-${desc.horizontal ? 'horizontal' : 'table'}`"
  )
    li(v-for="option in options")
      label
        input(
          :name="name",
          type="checkbox",
          v-model="data[name]",
          v-validate="validations",
          :disabled="disabled",
          :value="getValue(option)"
        )
        | {{ getLabel(option) }}
</template>

<style lang="sass">
.dito
  .dito-checkboxes
    input
      margin-right: 0.5em
</style>

<script>
import DitoComponent from '@/DitoComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

export default DitoComponent.register('checkboxes', {
  mixins: [OptionsMixin]
})
</script>
