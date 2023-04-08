<template lang="pug">
component(
  :is="schema.component"
  v-bind="$props"
)
</template>

<script>
// This is the general purpose 'component' type, which can resolve to any custom
// component through `schema.component`, see `resolveSchemaComponent()`. This
// can be used to nest arbitrary vue components in schema:
// {
//   type: 'component',
//   component: import('./component')
// }

import DitoTypeComponent from '../DitoTypeComponent.js'
import { resolveSchemaComponent } from '../utils/schema.js'

// @vue/component
export default DitoTypeComponent.register('component', {
  // Override the standard `defaultValue: null` to not set any data for custom
  // components, unless they provide a default value.
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  ignoreMissingValue: schema => !('default' in schema),

  async processSchema(api, schema) {
    await resolveSchemaComponent(schema)
  }
})
</script>
