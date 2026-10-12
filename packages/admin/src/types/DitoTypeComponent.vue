<template lang="pug">
component(
  :is="customComponent"
  :id="componentPath"
  ref="element"
  :schema="schema"
  :context="context"
  :modelValue="value"
  @update:modelValue="newValue => (value = newValue)"
  @change="onChange"
)
</template>

<script>
// The `component` type renders any custom component through `schema.component`,
// e.g. `component: import('./component')`. Custom components receive the
// `schema`, its `context` and the value as `modelValue`, and emit
// `update:modelValue` and `change`. Their root element gets the id that the
// label points to.

import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { resolveSchemaComponent } from '../utils/schema/setup.js'

// @vue/component
const DitoTypeComponent = DitoComponent.component('DitoTypeComponent', {
  props: fieldProps,

  setup(props) {
    const { context, value, onChange, focus } = useField(props)
    return { context, value, onChange, focus }
  },

  computed: {
    // @overridable
    customComponent() {
      return this.schema.component
    }
  }
})

defineType({
  types: ['component'],
  component: DitoTypeComponent,
  // Custom components get no data unless their schema has a `default`:
  defaultValue: undefined,
  ignoreMissingValue: ({ schema }) => !('default' in schema),

  async processSchema(api, schema) {
    await resolveSchemaComponent(schema)
  }
})

// Custom types render their component through the same contract:
export function wrapCustomComponent(component) {
  return {
    ...DitoTypeComponent,
    computed: {
      ...DitoTypeComponent.computed,
      // @override
      customComponent: () => component
    }
  }
}

export default DitoTypeComponent
</script>
