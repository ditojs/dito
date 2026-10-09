<template lang="pug">
.dito-section(:class="{ 'dito-section--labelled': hasLabel }")
  DitoSchemaInlined.dito-section__schema(
    :schema="getItemFormSchema(schema, item, context)"
    :dataPath="dataPath"
    :data="item"
    :meta="meta"
    :store="store"
    :label="label"
    :info="info"
    :padding="hasLabel ? 'nested' : 'inlined'"
    :disabled="disabled"
    :collapsed="collapsed"
    :collapsible="collapsible"
  )
</template>

<script>
import { normalizeDataPath, parseDataPath } from '@ditojs/utils'
import DitoTypeComponent from '../DitoTypeComponent.js'
import SchemaParentMixin from '../mixins/SchemaParentMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { setupSchemaComponents } from '../utils/schema/setup.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { hasComponentNamed, isCompact } from '../utils/schema/structure.js'

// @vue/component
export default DitoTypeComponent.register('section', {
  // Register the section's schema with the section rather than the form, so
  // that the section can reveal its components, see `navigateToComponent()`.
  mixins: [SchemaParentMixin],
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

  computed: {
    item() {
      return this.nested ? this.value : this.data
    },

    hasLabel() {
      return !!this.schema.label
    },

    collapsible: getSchemaAccessor('collapsible', {
      type: Boolean,
      default: false
    }),

    collapsed: getSchemaAccessor('collapsed', {
      type: Boolean,
      default: false,
      get(collapsed) {
        return collapsed && this.collapsible
      }
    })
  },

  methods: {
    getItemFormSchema,

    async navigateToComponent(dataPath, onComplete, options) {
      // Unnested sections share the data path of their parent schema, so
      // decide by schema whether the section displays the value at `dataPath`:
      const { mainSchemaComponent } = this
      const dataPathPrefix = this.dataPath ? `${this.dataPath}/` : ''
      const normalizedDataPath = normalizeDataPath(dataPath)
      const componentName = normalizedDataPath.startsWith(dataPathPrefix)
        ? parseDataPath(normalizedDataPath.slice(dataPathPrefix.length))[0]
        : null
      return (
        !!mainSchemaComponent &&
        hasComponentNamed(mainSchemaComponent.schema, componentName) &&
        mainSchemaComponent.navigateToComponent(dataPath, onComplete, options)
      )
    }
  },

  async processSchema(api, schema, name, routes, level) {
    // Process section components so their forms get resolved too.
    await setupSchemaComponents(api, schema, routes, level)
  }
})
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
