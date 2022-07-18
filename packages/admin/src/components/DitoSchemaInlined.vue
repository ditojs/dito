<template lang="pug">
  dito-schema.dito-schema-inlined(
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :label="isCompact ? null : label"
    :inlined="true"
    :disabled="disabled"
    :collapsed="collapsed"
    :collapsible="collapsible"
    :class="{ 'dito-schema-compact': isCompact }"
  )
    // Render dito-edit-buttons for inlined shemas separately from all
    // others in `TypeList` as a scope, for better handling of layout.
    template(#edit-buttons)
      dito-edit-buttons(
        v-if="deletable || draggable || editable"
        :deletable="deletable"
        :draggable="draggable"
        :editable="editable"
        :editPath="editPath"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        @delete="$emit('delete')"
      )
</template>

<style lang="sass">
  .dito-schema-inlined
    > .dito-schema-content
      padding: 0
      > .dito-schema-header
        // Change spacing so .dito-label covers the full .dito-schema-header.
        margin: -$form-spacing
        .dito-label
          // Add removed $form-spacing again
          --label-padding: #{$form-spacing}
          margin: 0
          width: 100%
          box-sizing: border-box
          // Because tables have a funny way of allowing too much width growth:
          max-width: $content-width
        & +.dito-pane
          // Needed for transition-height in DitoSchema:
          min-height: $form-spacing
</style>

<script>
import DitoComponent from '../DitoComponent.js'
import { isCompact } from '../utils/schema.js'
// @vue/component
export default DitoComponent.component('dito-schema-inlined', {
  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    label: { type: [String, Object], default: null },
    disabled: { type: Boolean, required: true },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null }
  },

  computed: {
    isCompact() {
      return isCompact(this.schema)
    },

    hasLabel() {
      return !this.isCompact && !!this.label
    }
  }
})
</script>
