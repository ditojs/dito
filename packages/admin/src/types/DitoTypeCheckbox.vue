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
import DitoTypeComponent from '../DitoTypeComponent.js'

// @vue/component
export default DitoTypeComponent.register('checkbox', {
  nativeField: true
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-checkbox {
  @extend %input-borderless;
}
</style>
