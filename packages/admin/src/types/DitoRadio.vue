<template lang="pug">
  ul.dito-radio
    li(v-for="option in desc.options")
      input(
        :id="name",
        :name="name",
        type="radio",
        v-model="data[name]",
        v-validate="validations",
        :disabled="disabled",
        :readonly="readonly",
        :value="option.value || option"
      )
      label
        | {{option}}
</template>

<style lang="sass">
  // Used both by DitoList and DitoPane
  ul.dito-radio
    display: table
    border-spacing: 0.2em
    padding-bottom: 0.5em
    > li
      display: table-row
      > *
        display: table-cell
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('radio')
</script>
