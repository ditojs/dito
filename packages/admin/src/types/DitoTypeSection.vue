<template lang="pug">
.dito-section(:class="{ 'dito-section-labelled': !!schema.label }")
  DitoPane.dito-section__pane(
    :schema="getItemFormSchema(schema, item, context)"
    :dataPath="dataPath"
    :data="item"
    :meta="meta"
    :store="store"
    :disabled="disabled"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { getItemFormSchema, processSchemaComponents } from '../utils/schema.js'

// @vue/component
export default DitoTypeComponent.register('section', {
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  ignoreMissingValue: schema => !schema.nested && !('default' in schema),
  defaultNested: false,
  generateLabel: false,

  computed: {
    item() {
      return this.nested ? this.value : this.data
    }
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
  &.dito-section-labelled {
    border: $border-style;
    border-radius: $border-radius;
    padding: $form-spacing;
    box-sizing: border-box;
  }

  .dito-section__pane {
    padding: 0;
  }
}
</style>
