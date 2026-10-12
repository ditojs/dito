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
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoTypeComputed = DitoComponent.component('DitoTypeComputed', {
  props: fieldProps,

  setup(props) {
    const { value, disabled, focus } = useField(props)
    return { value, disabled, focus }
  }
})

defineType({
  types: ['computed', 'data', 'hidden'],
  component: DitoTypeComputed,
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  defaultVisible: false,
  // The value is resolved from `schema.data` or `schema.dataPath` by
  // `DataModel`, see `hasValueFromDataSchema()`:
  valueFromDataSchema: true
})

export default DitoTypeComputed
</script>
