<template lang="pug">
  p(:class={ 'control': true })
    input(
      :id="name",
      :class="{ 'input': true, 'is-danger': errors.has(name) }"
      type="number",
      :data-vv-name="name",
      v-model="data[name]",
      v-validate="validations",
      :placeholder="placeholder",
      :disabled="disabled",
      :step="step"
    )
    span(v-show="errors.has(name)",  class="help is-danger")
      | Errors: {{ errors.collect() }}
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
