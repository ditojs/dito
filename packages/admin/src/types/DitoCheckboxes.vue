<template lang="pug">
  ul.dito-checkboxes
    li(v-for="option in desc.options")
      input(
        :id="name",
        :name="name",
        type="checkbox",
        v-model="data[name]",
        v-validate="validations",
        :disabled="disabled",
        :value="option.value || option"
      )
      label
        | {{option}}
</template>

<style lang="sass">
  ul.dito-checkboxes
    display: table
    border-spacing: 0.2em
    padding-bottom: 0.5em
    display: table-row
    > li
      display: table-cell
      > label
        padding-left: 0.5em
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('checkboxes')
</script>
