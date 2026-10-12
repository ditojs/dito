<template lang="pug">
input.dito-text.dito-input(
  :id="componentPath"
  ref="element"
  :name="name"
  type="text"
  :value="value"
  :disabled="disabled"
  :readonly="true"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'

// @vue/component
const DitoTypeComputed = DitoTypeComponent.component('DitoTypeComputed', {})

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
