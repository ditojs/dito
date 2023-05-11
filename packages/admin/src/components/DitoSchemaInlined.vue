<template lang="pug">
DitoSchema.dito-schema-inlined(
  :class="{ 'dito-schema-compact': isCompact }"
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
  :generateLabels="!isCompact"
  :accumulatedBasis="accumulatedBasis"
)
  //- Render dito-edit-buttons for inlined schemas separately from all
  //- others in `TypeList` as a scope, for better handling of layout.
  template(#edit-buttons)
    DitoEditButtons(
      v-if="deletable || draggable || editable"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
      :deletable="deletable"
      :draggable="draggable"
      :editable="editable"
      :editPath="editPath"
      @delete="$emit('delete')"
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { isCompact } from '../utils/schema.js'
// @vue/component
export default DitoComponent.component('DitoSchemaInlined', {
  emits: ['delete'],

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
    editPath: { type: String, default: null },
    accumulatedBasis: { type: Number, default: null }
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

<style lang="scss">
@import '../styles/_imports';

.dito-schema-inlined {
  > .dito-schema-content {
    > .dito-pane {
      padding: 0;
    }

    > .dito-schema-header {
      justify-content: space-between;
      position: relative;

      .dito-label {
        width: 100%;
        margin: 0;
        // Prevent collapsing to min-height when alone in
        // .dito-schema-content, due to grid-template-rows: min-content
        min-height: $input-height;
      }
    }

    &:has(> .dito-schema-header) > .dito-pane {
      // Clear top-margin if the components are preceded by a schema header
      margin-top: 0;
    }
  }
}
</style>
