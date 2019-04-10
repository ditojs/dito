<template lang="pug">
  dito-schema.dito-schema-inlined(
    :schema="schema"
    :dataPath="dataPath"
    :key="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :label="compact ? null: label"
    :disabled="disabled"
    :class="{ 'dito-schema-compact': compact }"
  )
</template>

<style lang="sass">
.dito
  .dito-schema-inlined
    > .dito-schema-content
      padding: 0
    .dito-schema-header
      padding-bottom: $form-spacing
</style>

<script>
import DitoComponent from '@/DitoComponent'

// @vue/component
export default DitoComponent.component('dito-schema-inlined', {
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
      return this.schema.compact
    }
  }
})
</script>
