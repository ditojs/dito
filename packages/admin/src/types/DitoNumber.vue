<template lang="pug">
  input(:id="name", type="number", v-model="data[name]", :disabled="disabled",
    :readonly="readonly", :placeholder="placeholder",
    :step="step", :min="min", :max="max")
</template>

<style lang="sass">
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
