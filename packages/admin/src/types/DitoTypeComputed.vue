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

export default DitoTypeComponent.register(
  ['computed', 'data', 'hidden'],
  // @vue/component
  {
    defaultValue: () => undefined, // Callback to override `defaultValue: null`
    defaultVisible: false,
    // The value is resolved from `schema.data` or `schema.dataPath` by
    // `DataModel`, see `hasValueFromDataSchema()`:
    valueFromDataSchema: true
  }
)
</script>
