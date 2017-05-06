<template lang="pug">
  input(
    :id="name",
    :name="name",
    type="number",
    v-model="data[name]",
    v-validate="validations",
    :placeholder="placeholder",
    :disabled="disabled",
    :readonly="readonly",
    :step="step"
  )
</template>

<style lang="sass">
.dito
  // Only show spin buttons if the number component defines a step size.
  input[type="number"]:not([step])
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button
      -webkit-appearance: none;
      margin: 0;
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('number')
</script>
