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
    :labelNode="labelNode"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { getItemFormSchema, processSchemaComponents } from '../utils/schema.js'

// @vue/component
export default DitoTypeComponent.register('section', {
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  ignoreMissingValue: ({ schema }) => !schema.nested && !('default' in schema),
  defaultNested: false,
  generateLabel: false,

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
    getItemFormSchema
  },

  async processSchema(api, schema, name, routes, level) {
    // Process section components so their forms get resolved too.
    await processSchemaComponents(api, schema, routes, level)
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-section {
  &--labelled {
    border: $border-width solid transparent;
    border-radius: $border-radius;
    transition: border-color 0.2s $ease-out-quart;
    margin-top: $form-spacing-half;

    &:has(.dito-schema--open) {
      border-color: $border-color;
    }
  }
}
</style>
