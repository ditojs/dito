<template lang="pug">
  dito-schema.dito-schema-inline(
    :schema="schema"
    :dataPath="dataPath"
    :key="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :label="compact ? null : label"
    :disabled="disabled"
    :class="{ 'dito-schema-compact': compact }"
  )
</template>

<style lang="sass">
.dito
  .dito-schema-inline
    padding: 0
    .dito-schema-header
      padding-bottom: $form-spacing
    .dito-components.dito-fill
      // When nested, erase the .dito-component.dito-fill style from above again
      width: auto
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isObjectSource } from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-schema-inline', {
  props: {
    schema: { type: Object, default: null },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    label: { type: String, default: null },
    disabled: { type: Boolean, required: true }
  },

  computed: {
    compact() {
      // The default is true for object sources:
      return this.schema.compact ?? isObjectSource(this.sourceSchema)
    }
  }
})
</script>
