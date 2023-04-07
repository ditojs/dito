<template lang="pug">
DitoLabel.dito-label-component(
  :label="value"
  :dataPath="dataPath"
)
</template>

<script>
import TypeComponent from '../TypeComponent.js'

// @vue/component
export default TypeComponent.register('label', {
  excludeValue: true,
  generateLabel: false
})
</script>

<style lang="scss">
.dito-label-component {
  display: flex;
  height: 2em;
}
</style>
