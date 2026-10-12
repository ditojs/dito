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

import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { resolveSchemaComponent } from '../utils/schema/setup.js'

// @vue/component
const DitoTypeCustomComponent = DitoComponent.component('DitoTypeComponent', {
  props: fieldProps,

  setup(props) {
    const { focus } = useField(props)
    return { focus }
  }
})

defineType({
  types: ['component'],
  component: DitoTypeCustomComponent,
  // Override the standard `defaultValue: null` to not set any data for custom
  // components, unless their schema provides a `default` value. This also
  // applies to `default: undefined`, which `getDefaultValue()` ignores.
  defaultValue: () => undefined,
  ignoreMissingValue: ({ schema }) => !('default' in schema),

  async processSchema(api, schema) {
    await resolveSchemaComponent(schema)
  }
})

export default DitoTypeCustomComponent
</script>
