<template lang="pug">
//- Renders an item of a list or object source: Inlined items render their
//- form, others the source's `component`, or the label that the source renders
//- for them.
DitoSchemaInlined(
  v-if="isInlined"
  :label="label"
  :schema="formSchema"
  :dataPath="dataPath"
  :data="data"
  :store="store"
  :disabled="disabled"
  :collapsed="collapsed"
  :collapsible="collapsible"
  :deletable="deletable"
  :draggable="draggable"
  :editable="editable"
  :editPath="editPath"
  :createPath="createPath"
  :insertIndex="insertIndex"
  @delete="$emit('delete')"
  @move="delta => $emit('move', delta)"
)
component(
  v-else-if="schema.component"
  :is="schema.component"
  :schema="schema"
  :context="context"
  :modelValue="data"
)
span(
  v-else
  v-html="label"
)
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { isInlined } from '../utils/schema/structure.js'

// @vue/component
export default DitoComponent.component('DitoSourceItem', {
  emits: ['delete', 'move'],

  props: {
    // The schema of the list or object source that holds the item.
    schema: { type: Object, required: true },
    // The form of the item, which inlined items render:
    formSchema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    // The index of the item in a list source, `null` in object sources.
    index: { type: Number, default: null },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    // The remaining props only apply to inlined items, see `DitoSchemaInlined`:
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null },
    createPath: { type: String, default: null },
    insertIndex: { type: Number, default: null }
  },

  computed: {
    isInlined() {
      return isInlined(this.schema)
    },

    label() {
      return this.source.getItemLabel(this.data, this.index)
    }
  }
})
</script>
