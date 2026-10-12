<template lang="pug">
.dito-section(:class="{ 'dito-section--labelled': !!schema.label }")
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
import { normalizeDataPath, parseDataPath } from '@ditojs/utils'
import { computed } from 'vue'
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import SchemaParentMixin from '../mixins/SchemaParentMixin.js'
import { setupSchemaComponents } from '../utils/schema/setup.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { hasComponentNamed, isCompact } from '../utils/schema/structure.js'

// @vue/component
const DitoTypeSection = DitoComponent.component('DitoTypeSection', {
  // Register the section's schema with the section rather than the form, so
  // that the section can reveal its components, see `revealComponents()`.
  mixins: [SchemaParentMixin],
  props: fieldProps,

  setup(props) {
    const { value, context, info, disabled, focus, getSchemaValue } =
      useField(props)
    // Nested sections hold their item in their value:
    const item = computed(() => (props.nested ? value.value : props.data))
    const collapsible = computed(() =>
      getSchemaValue('collapsible', { type: Boolean, default: false })
    )
    return {
      item,
      info,
      disabled,
      focus,
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
  },

  methods: {
    async revealComponents(dataPath) {
      // Unnested sections share the data path of their parent schema, so
      // decide by schema whether the section displays the value at `dataPath`:
      const { mainSchemaComponent } = this
      const dataPathPrefix = this.dataPath ? `${this.dataPath}/` : ''
      const normalizedDataPath = normalizeDataPath(dataPath)
      const componentName = normalizedDataPath.startsWith(dataPathPrefix)
        ? parseDataPath(normalizedDataPath.slice(dataPathPrefix.length))[0]
        : null
      return (
        mainSchemaComponent &&
        hasComponentNamed(mainSchemaComponent.schema, componentName)
      )
        ? mainSchemaComponent.revealComponents(dataPath)
        : []
    }
  }
})

defineType({
  types: ['section'],
  component: DitoTypeSection,
  // Nested sections hold their data in an object, other sections don't have
  // their own value, also with `default: undefined`, which `getDefaultValue()`
  // ignores. The callback overrides the standard `defaultValue: null`.
  defaultValue: ({ schema }) => (schema.nested ? {} : undefined),
  ignoreMissingValue: ({ schema }) => !schema.nested && !('default' in schema),
  // The object of nested sections can't be `null`, unlike the value of the
  // `object` type, where `null` means that there's no object.
  treatNullAsMissing: ({ schema }) => !!schema.nested,
  defaultNested: false,
  generateLabel: false,

  // The header of the section's form displays the label, except in compact
  // forms, which don't have labels in their header, see `DitoSchemaInlined`.
  // The form can depend on the item, see `item`.
  rendersOwnLabel: context =>
    !isCompact(
      getItemFormSchema(
        context.schema,
        context.nested ? context.value : context.item,
        context
      )
    ),

  async processSchema(api, schema) {
    // Process section components so their forms get resolved too.
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
