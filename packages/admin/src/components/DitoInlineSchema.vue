<template lang="pug">
  dito-schema.dito-inline-schema(
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :label="compact ? null : label"
    :disabled="disabled"
  )
</template>

<style lang="sass">
.dito
  .dito-inline-schema
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

export default DitoComponent.component('dito-inline-schema', {
  props: {
    schema: { type: Object },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    label: { type: String, required: false },
    disabled: { type: Boolean, required: true }
  },

  computed: {
    compact() {
      // The default is true for object sources:
      return this.schema.compact ?? isObjectSource(this.meta.schema)
    }
  }
})
</script>
