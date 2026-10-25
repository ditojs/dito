<template lang="pug">
.dito-section(
  ref="element"
  :class="{ 'dito-section--labelled': isLabelled }"
  role="region"
  :aria-label="labelText || labelize(schema.name) || null"
)
  DitoSchemaInlined.dito-section__schema(
    :schema="formSchema"
    :dataPath="dataPath"
    :data="item"
    :store="store"
    :label="hasLayout ? null : label"
    :info="hasLayout ? null : info"
    :padding="isLabelled ? 'nested' : 'inlined'"
    :bordered="isLabelled"
    :disabled="disabled"
    :collapsed="collapsed"
    :collapsible="collapsible"
  )
</template>

<script>
import { computed, h, provide, unref } from 'vue'
import { labelize } from '@ditojs/utils'
import { defineType } from '../utils/schema/types.ts'
import { nestableTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import {
  resolveSchemaComponent,
  setupSchemaComponents
} from '../utils/schema/setup.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { isCompact, hasNestedData } from '../utils/schema/structure.js'
import { schemaLayoutKey } from '../utils/keys.ts'

// @vue/component
const DitoSectionType = {
  props: fieldProps,

  setup(props, { slots }) {
    const field = useField(props)
    const { value, context, getSchemaValue } = field
    // Nested sections hold their item in their value:
    const item = computed(() => (props.nested ? value.value : props.data))
    const collapsible = computed(() =>
      getSchemaValue('collapsible', { type: Boolean, default: false })
    )
    // Layouts place the section's components, see `DitoSchemaField`:
    const hasLayout = computed(() => !!props.schema.component)
    // The section's `component`, or the widgets of `DitoSection`:
    provide(
      schemaLayoutKey,
      computed(() =>
        hasLayout.value
          ? () =>
              h(props.schema.component, {
                schema: props.schema,
                context: unref(context)
              })
          : slots.default
            ? () => slots.default()
            : null
      )
    )
    return {
      ...field,
      labelize,
      item,
      collapsible,
      hasLayout,
      // The header with the label displays above the bordered content:
      isLabelled: computed(() => !!props.schema.label && !hasLayout.value),
      collapsed: computed(
        () => (
          getSchemaValue('collapsed', { type: Boolean, default: false }) &&
          collapsible.value
        )
      ),
      formSchema: computed(() =>
        getItemFormSchema(props.schema, item.value, context)
      )
    }
  }
}

defineType({
  type: 'section',
  component: DitoSectionType,
  ...nestableTraits,
  generatesLabel: false,
  alignsBelowLabels: false,

  // The form's header shows the label, except in layouts and compact forms.
  // The form can depend on the item:
  hasLabel: context => (
    !!context.schema.component ||
    isCompact(
      getItemFormSchema(
        context.schema,
        hasNestedData(context.schema) ? context.value : context.item,
        context
      )
    )
  ),

  async setupSchema({ schema, api, name }) {
    // Layouts replace the section's header and its tabs:
    if (schema.component) {
      for (const key of ['tabs', 'collapsible', 'clipboard']) {
        if (schema[key]) {
          throw new Error(
            `Unsupported '${key}' in sections with 'component': '${name}'.`
          )
        }
      }
    }
    await Promise.all([
      setupSchemaComponents(api, schema),
      resolveSchemaComponent(schema)
    ])
  }
})

export default DitoSectionType
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-section {
  // Inset the chevrons of collapsible sections like the ones of lists, in line
  // with the content of the section:
  &__schema > .dito-schema-header > button.dito-label {
    margin-left: $form-spacing + $border-width;
  }
}
</style>
