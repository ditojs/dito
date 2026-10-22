<template lang="pug">
input.dito-text.dito-input(
  :id="componentPath"
  ref="element"
  :name="schema.name"
  type="text"
  :value="value"
  :disabled="disabled"
  :readonly="true"
  :class="{ 'dito-input--has-errors': !!errorsElementId }"
)
</template>

<script>
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoValueType = {
  props: fieldProps,
  setup: props => useField(props)
}

defineType({
  type: 'value',
  component: DitoValueType,
  defaultValue: undefined,
  defaultVisible: false,
  resolvesValue: true,
  getProperty: () => ({})
})

export default DitoValueType
</script>
