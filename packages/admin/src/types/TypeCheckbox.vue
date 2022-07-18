<template lang="pug">
  input.dito-checkbox(
    ref="element"
    :id="dataPath"
    type="checkbox"
    v-model="value"
    v-bind="attributes"
    v-on="listeners"
  )
</template>

<style lang="sass">
  .dito-checkbox
    @extend %input-borderless
</style>

<script>
import TypeComponent from '../TypeComponent.js'

// @vue/component
export default TypeComponent.register('checkbox', {
  nativeField: true
})
</script>
