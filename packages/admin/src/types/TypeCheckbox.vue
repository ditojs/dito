<template lang="pug">
input.dito-checkbox(
  ref="element"
  :id="dataPath"
  type="checkbox"
  v-model="value"
  v-bind="attributes"
)
</template>

<style lang="sass">
  @import '../styles/_imports'

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
