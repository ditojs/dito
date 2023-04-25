<template lang="pug">
DitoLabel.dito-label-component(
  :label="value"
  :dataPath="dataPath"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'

// @vue/component
export default DitoTypeComponent.register('label', {
  excludeValue: true,
  generateLabel: false,
  keepAligned: false
})
</script>

<style lang="scss">
.dito-label-component {
  display: flex;
  height: 2em;
}
</style>
