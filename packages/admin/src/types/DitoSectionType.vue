<template lang="pug">
.dito-section(
  ref="element"
  :class="{ 'dito-section--labelled': !!schema.label && !hasLayout }"
  role="region"
  :aria-label="labelText || labelize(schema.name)"
)
  DitoSchemaInlined.dito-section__schema(
    :schema="formSchema"
    :dataPath="dataPath"
    :data="item"
    :store="store"
    :label="hasLayout ? null : label"
    :info="hasLayout ? null : info"
    :padding="schema.label && !hasLayout ? 'nested' : 'inlined'"
    :disabled="disabled"
    :collapsed="collapsed"
    :collapsible="collapsible"
  )
    template(
      v-if="hasLayout"
      #default
    )
      component(
        :is="schema.component"
        :schema="schema"
        :context="context"
      )
</template>

<script>
import { computed } from 'vue'
import { labelize } from '@ditojs/utils'
import { defineType } from '../utils/schema/types.ts'
import { nestableTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import {
  resolveSchemaComponent,
  setupSchemaComponents
} from '../utils/schema/setup.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { isCompact } from '../utils/schema/structure.js'

// @vue/component
const DitoSectionType = {
  props: fieldProps,

  setup(props) {
    const field = useField(props)
    const { value, context, getSchemaValue } = field
    // Nested sections hold their item in their value:
    const item = computed(() => (props.nested ? value.value : props.data))
    const collapsible = computed(() =>
      getSchemaValue('collapsible', { type: Boolean, default: false })
    )
    return {
      ...field,
      labelize,
      item,
      collapsible,
      // Layouts place the section's components, see `DitoField`:
      hasLayout: computed(() => !!props.schema.component),
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

  // The form's header shows the label, except in layouts and compact forms.
  // The form can depend on the item:
  hasLabel: context => (
    !!context.schema.component ||
    isCompact(
      getItemFormSchema(
        context.schema,
        context.nested ? context.value : context.item,
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

  &--labelled > &__schema {
    // Display the header with the label above the bordered content.
    > .dito-schema-content {
      border: $border-style;
      border-radius: $border-radius;
      margin-top: $form-spacing-half;
    }

    > .dito-schema-header + .dito-schema-content > .dito-pane {
      // Inside the border, the content's margin replaces the spacing below the
      // header, see `DitoSchema`.
      margin-top: -$form-spacing-half;
    }
  }
}
</style>
