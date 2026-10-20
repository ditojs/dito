<template lang="pug">
component(
  :is="customComponent"
  :id="componentPath"
  ref="element"
  v-bind="isDisplayOnly ? attributes : { ...attributes, ...model }"
  :schema="schema"
  :context="context"
  :errorsElementId="errorsElementId"
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
const DitoComponentType = {
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
    const customComponent = computed(() => props.schema.component)
    return {
      context,
      componentPath,
      attributes,
      customComponent,
      // Display-only components get no value, or it falls through as an
      // attribute to their root element:
      isDisplayOnly: computed(() =>
        isDisplayOnly(customComponent.value, props.schema)
      ),
      model: computed(() => ({
        'modelValue': value.value,
        'onUpdate:modelValue': newValue => (value.value = newValue)
      }))
    }
  }
}

defineType({
  type: 'component',
  component: DitoComponentType,
  // Custom components get no data unless their schema has a `default`:
  defaultValue: undefined,
  ignoresMissingValue: ({ schema }) => !('default' in schema),
  getProperty: schema => ('default' in schema ? {} : null),

  async setupSchema({ schema }) {
    await resolveSchemaComponent(schema)
    checkContract(schema.component, schema)
  }
})

// Custom types render their component through the same contract:
export function wrapCustomComponent(component) {
  checkContract(component)
  return {
    ...DitoComponentType,

    setup(props, context) {
      return {
        ...DitoComponentType.setup(props, context),
        customComponent: component,
        isDisplayOnly: false
      }
    }
  }
}

// Undeclared events fall through as native listeners, so a native `change`
// would emit the schema's `change` event a second time:
function checkContract(component, schema) {
  if (process.env.NODE_ENV !== 'production' && component) {
    const getMissing = (option, names) =>
      names.filter(name => !isDeclared(component, option, name))
    const missing = [
      ...getMissing('props', ['schema', 'context']),
      ...(
        schema && isDisplayOnly(component, schema)
          ? []
          : [
              ...getMissing('props', ['modelValue']),
              ...getMissing('emits', ['update:modelValue', 'change'])
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

// Fields without a `default` may only display, with components that declare
// neither the value nor its updates. They may still declare `change`, to keep
// the native events of their own inputs to themselves:
function isDisplayOnly(component, schema) {
  return (
    !('default' in schema) &&
    !isDeclared(component, 'props', 'modelValue') &&
    !isDeclared(component, 'emits', 'update:modelValue')
  )
}

// Look through `extends` and `mixins` too, as Vue merges their declarations:
function isDeclared(component, option, name) {
  const declared = component[option]
  return (
    (
      isArray(declared)
        ? declared.includes(name)
        : Object.hasOwn(declared ?? {}, name)
    ) ||
    [component.extends, ...(component.mixins ?? [])].some(
      parent => parent && isDeclared(parent, option, name)
    )
  )
}

export default DitoComponentType
</script>
