<template lang="pug">
DitoLabel.dito-label-component(
  ref="element"
  :label="value"
  :context="context"
)
</template>

<script>
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoTypeLabel = {
  name: 'DitoTypeLabel',
  props: fieldProps,
  setup: props => useField(props)
}

defineType({
  type: 'label',
  component: DitoTypeLabel,
  excludeValue: true,
  generateLabel: false,
  rendersLabel: true
})

export default DitoTypeLabel
</script>

<style lang="scss">
.dito-label-component {
  display: flex;
  height: 2em;
}
</style>
