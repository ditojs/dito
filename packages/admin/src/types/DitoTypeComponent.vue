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
  template(
    v-if="$slots.default"
    #default
  )
    slot
</template>

<script>
// The field's attributes and listeners fall through to the custom component's
// root element, unless it emits these events.

import { computed } from 'vue'
import { isArray } from '@ditojs/utils'
import { defineType, getOptionsDataSchema } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { resolveSchemaComponent } from '../utils/schema/setup.js'

// @vue/component
const DitoTypeComponent = {
  props: fieldProps,

  setup(props) {
    // The contexts of custom types with options hold them, like selects:
    const members = getOptionsDataSchema(props.schema)
      ? {
          get options() {
            const { schema, data, dataPath } = props
            return (
              services.dataContext.model.getOptionsResolver({
                schema,
                data,
                name: schema.name,
                dataPath
              }).value ?? []
            )
          }
        }
      : null
    const { context, componentPath, value, attributes, services } = useField(
      props,
      { members }
    )
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

  async setupSchema({ schema }) {
    await resolveSchemaComponent(schema)
    checkContract(schema.component, schema)
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
function checkContract(component, schema) {
  if (process.env.NODE_ENV !== 'production' && component) {
    const getMissing = (declared, names) => {
      const keys = isArray(declared) ? declared : Object.keys(declared ?? {})
      return names.filter(name => !keys.includes(name))
    }
    const missingModelProps = getMissing(component.props, ['modelValue'])
    const missingModelEmits = getMissing(component.emits, ['update:modelValue'])
    // Fields without a `default` may only display, with components that
    // declare neither the value nor its updates. They may still declare
    // `change`, to keep the native events of their own inputs to themselves:
    const isDisplayOnly = (
      schema &&
      !('default' in schema) &&
      missingModelProps.length > 0 &&
      missingModelEmits.length > 0
    )
    const missing = [
      ...getMissing(component.props, ['schema', 'context']),
      ...(
        isDisplayOnly
          ? []
          : [
              ...missingModelProps,
              ...missingModelEmits,
              ...getMissing(component.emits, ['change'])
            ]
      )
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
