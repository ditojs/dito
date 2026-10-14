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
import { deprecate } from '@ditojs/utils'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoTypeValue = {
  props: fieldProps,
  setup: props => useField(props)
}

defineType({
  // `computed`, `data` and `hidden` are deprecated names until 5.0:
  type: ['value', 'computed', 'data', 'hidden'],
  component: DitoTypeValue,
  defaultValue: undefined,
  defaultVisible: false,
  resolvesValue: true,

  setupSchema({ schema }) {
    if (schema.type !== 'value') {
      deprecate(
        `\`type: '${schema.type}'\` is deprecated, use \`type: 'value'\` ` +
        'instead.'
      )
    }
  }
})

export default DitoTypeValue
</script>
