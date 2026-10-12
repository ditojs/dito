<template lang="pug">
DitoLabel.dito-label-component(:label="value")
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoTypeLabel = DitoComponent.component('DitoTypeLabel', {
  props: fieldProps,

  setup(props) {
    const { value, focus } = useField(props)
    return { value, focus }
  }
})

defineType({
  types: ['label'],
  component: DitoTypeLabel,
  excludeValue: true,
  generateLabel: false,
  replaceWithLabel: true
})

export default DitoTypeLabel
</script>

<style lang="scss">
.dito-label-component {
  display: flex;
  height: 2em;
}
</style>
