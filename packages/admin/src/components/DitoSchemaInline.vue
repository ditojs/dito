<template lang="pug">
  dito-schema.dito-schema-inline(
    :schema="schema"
    :dataPath="dataPath"
    :key="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :label="label"
    :disabled="disabled"
    :class="{ 'dito-schema-compact': schema.compact }"
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
  }
})
</script>
