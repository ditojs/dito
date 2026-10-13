<template lang="pug">
.dito-section(
  ref="element"
  :class="{ 'dito-section--labelled': !!schema.label }"
)
  DitoSchemaInlined.dito-section__schema(
    :schema="formSchema"
    :dataPath="dataPath"
    :data="item"
    :store="store"
    :label="label"
    :info="info"
    :padding="schema.label ? 'nested' : 'inlined'"
    :disabled="disabled"
    :collapsed="collapsed"
    :collapsible="collapsible"
  )
</template>

<script>
import { computed } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { nestableTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { setupSchemaComponents } from '../utils/schema/setup.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { isCompact } from '../utils/schema/structure.js'

// @vue/component
const DitoTypeSection = {
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
      item,
      collapsible,
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
  component: DitoTypeSection,
  ...nestableTraits,
  generatesLabel: false,

  // The form's header shows the label, except in compact forms. The form can
  // depend on the item:
  hasLabel: context =>
    isCompact(
      getItemFormSchema(
        context.schema,
        context.nested ? context.value : context.item,
        context
      )
    ),

  async setupSchema({ schema, api }) {
    await setupSchemaComponents(api, schema)
  }
})

export default DitoTypeSection
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-section {
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
