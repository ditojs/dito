<template lang="pug">
  .dito-section(
    :class="{ 'dito-section-labelled' : !!schema.label }"
  )
    dito-pane.dito-section-pane(
      :schema="getItemFormSchema(schema, item, context)"
      :dataPath="dataPath"
      :data="item"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
</template>

<style lang="sass">
  .dito-section
    &.dito-section-labelled
      border: $border-style
      border-radius: $border-radius
      padding: $form-spacing
      box-sizing: border-box
</style>

<script>
import TypeComponent from '@/TypeComponent'
import { getItemFormSchema } from '@/utils/schema'

// @vue/component
export default TypeComponent.register('section', {
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  ignoreMissingValue: schema => !schema.nested && !('default' in schema),
  defaultNested: false,
  generateLabel: false,
  omitFlexGrow: true,

  computed: {
    item() {
      return this.nested ? this.value : this.data
    }
  },

  methods: {
    getItemFormSchema
  }
})
</script>
