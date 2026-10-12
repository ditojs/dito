<template lang="pug">
component(
  :is="customComponent"
  :id="componentPath"
  ref="element"
  v-bind="attributes"
  :schema="schema"
  :context="context"
  :modelValue="value"
  :errorsElementId="errorsElementId"
  @update:modelValue="newValue => (value = newValue)"
)
</template>

<script>
// The field's attributes and listeners fall through to the custom component's
// root element, unless it emits these events.

import { computed } from 'vue'
import { isArray } from '@ditojs/utils'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { resolveSchemaComponent } from '../utils/schema/setup.js'

// @vue/component
const DitoTypeComponent = {
  name: 'DitoTypeComponent',
  props: fieldProps,

  setup(props) {
    const { context, componentPath, value, attributes } = useField(props)
    return {
      context,
      componentPath,
      value,
      attributes,
      customComponent: computed(() => props.schema.component)
    }
  }
}

defineType({
  type: 'component',
  component: DitoTypeComponent,
  // Custom components get no data unless their schema has a `default`:
  defaultValue: undefined,
  ignoresMissingValue: ({ schema }) => !('default' in schema),

  async setupSchema(api, schema) {
    await resolveSchemaComponent(schema)
    checkContract(schema.component)
  }
})

// Custom types render their component through the same contract:
export function wrapCustomComponent(component) {
  checkContract(component)
  return {
    ...DitoTypeComponent,

    setup(props, context) {
      return {
        ...DitoTypeComponent.setup(props, context),
        customComponent: component
      }
    }
  }
}

// Undeclared events fall through as native listeners, so a native `change`
// would emit the schema's `change` event a second time:
function checkContract(component) {
  if (process.env.NODE_ENV !== 'production' && component) {
    const getMissing = (declared, names) => {
      const keys = isArray(declared) ? declared : Object.keys(declared ?? {})
      return names.filter(name => !keys.includes(name))
    }
    const missing = [
      ...getMissing(component.props, ['schema', 'context', 'modelValue']),
      ...getMissing(component.emits, ['update:modelValue', 'change'])
    ]
    if (missing.length > 0) {
      console.warn(
        `Custom component '${
          component.name ?? component.__file ?? 'anonymous'
        }' doesn't ` +
        `declare the props and emits of its contract: ${missing.join(', ')}.`
      )
    }
  }
}

export default DitoTypeComponent
</script>
