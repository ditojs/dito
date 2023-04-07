<template lang="pug">
input.dito-checkbox(
  :id="dataPath"
  ref="element"
  v-model="value"
  type="checkbox"
  v-bind="attributes"
)
</template>

<script>
import TypeComponent from '../TypeComponent.js'

// @vue/component
export default TypeComponent.register('checkbox', {
  nativeField: true
})
</script>

<style lang="sass">
@import '../styles/_imports'

.dito-checkbox
  @extend %input-borderless
</style>
