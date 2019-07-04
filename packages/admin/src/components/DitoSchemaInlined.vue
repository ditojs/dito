<template lang="pug">
  .dito-schema-inlined(
    :class="{ 'dito-schema-labeled': labeled }"
  )
    dito-schema(
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :label="compact ? null: label"
      :inlined="true"
      :disabled="disabled"
      :collapsed="collapsed"
      :collapsible="collapsible"
      :class="{ 'dito-schema-compact': compact }"
    )
    // Render dito-edit-buttons for inlined shemas separately from
    // all others in `TypeList`, because of layout concerns.
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
    position: relative
    > .dito-schema > .dito-schema-content
      padding: 0
    .dito-schema-header
      // Change spacing so that .dito-label covers the full .dito-schema-header.
      margin: -$form-spacing
      .dito-label
        height: 2em // Same as round buttons
        box-sizing: content-box
        // Add removed $form-spacing again
        padding: $form-spacing
      & +.dito-components
        // Needed for transition-height in DitoSchema:
        min-height: $form-spacing
    &.dito-schema-labeled
      > .dito-buttons
        z-index: 2 // above `button.dito-label`
        position: absolute
        top: 0
        right: 0
    &:not(.dito-schema-labeled)
      display: flex
      > .dito-schema
        flex: 1 1 100%
      > .dito-buttons
        flex: 1 1 0%
        margin-left: $form-spacing
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
    disabled: { type: Boolean, required: true },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null }
  },

  computed: {
    compact() {
      return this.schema.compact
    },

    labeled() {
      return !this.compact && !!this.label
    }
  }
})
</script>
