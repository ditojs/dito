<template lang="pug">
  dito-components.dito-inline-components(
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :disabled="disabled"
  )
    li.dito-components-header(
      v-if="header"
      slot="header"
    ) {{ header }}
</template>

<style lang="sass">
.dito
  .dito-inline-components
    .dito-components.dito-fill
      // When nested, erase the .dito-component.dito-fill style from above again
      width: auto
  .dito-components-header
    flex-basis: 100%
    padding: $form-spacing
    margin: 0 (-$form-spacing-half)
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-inline-components', {
  props: {
    label: { type: String },
    schema: { type: Object },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  },

  computed: {
    header() {
      if (!this.schema.compact) {
        const label = this.getLabel(this.schema)
        return this.label ? `${label}: ${this.label}` : label
      }
    }
  }
})
</script>
