<template lang="pug">
DitoLabel.dito-label-component(:label="value")
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'

// @vue/component
const DitoTypeLabel = DitoTypeComponent.component('DitoTypeLabel', {})

defineType({
  types: ['label'],
  component: DitoTypeLabel,
  excludeValue: true,
  generateLabel: false,
  isLabel: true
})

export default DitoTypeLabel
</script>

<style lang="scss">
.dito-label-component {
  display: flex;
  height: 2em;
}
</style>
