<template lang="pug">
<!--  TODO get rid of root element here -->
  div
    input.dito-checkbox(
      :id="name",
      :name="name",
      type="checkbox",
      v-model="data[name]",
      v-validate="validations",
      :disabled="disabled"
    )
</template>

<style lang="sass">
  input.dito-checkbox
    border-spacing: 0.2em
    padding-bottom: 0.5em
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('checkbox')
</script>
