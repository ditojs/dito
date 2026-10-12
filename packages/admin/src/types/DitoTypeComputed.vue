<template lang="pug">
input.dito-text.dito-input(
  :id="componentPath"
  ref="element"
  :name="schema.name"
  type="text"
  :value="value"
  :disabled="disabled"
  :readonly="true"
)
</template>

<script>
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoTypeComputed = {
  name: 'DitoTypeComputed',
  props: fieldProps,
  setup: props => useField(props)
}

defineType({
  types: ['computed', 'data', 'hidden'],
  component: DitoTypeComputed,
  defaultValue: undefined,
  defaultVisible: false,
  resolveValue: true
})

export default DitoTypeComputed
</script>
