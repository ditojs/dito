<template lang="pug">
//- Renders an item of a list or object source: Inlined items render their
//- form, others the source's `component`, `render()` or the item's label.
DitoSchemaInlined(
  v-if="isInlined"
  :label="inlinedLabel"
  :schema="formSchema"
  :dataPath="dataPath"
  :data="data"
  :meta="meta"
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
  :dataPath="dataPath"
  :data="data"
  :nested="false"
)
span(
  v-else-if="sourceComponent.render"
  v-html="renderedItem"
)
span(
  v-else
  v-html="itemLabel"
)
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import { isInlined, isListSource } from '../utils/schema/structure.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'

// @vue/component
export default DitoComponent.component('DitoSourceItem', {
  emits: ['delete', 'move'],

  props: {
    // The schema of the list or object source that holds the item.
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    // The index of the item in a list source, `null` in object sources.
    index: { type: Number, default: null },
    meta: { type: Object, required: true },
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

    formSchema() {
      return getItemFormSchema(
        this.schema,
        this.data,
        this.sourceComponent.context
      )
    },

    inlinedLabel() {
      // List items always show their label, objects only when collapsible.
      return isListSource(this.schema) || this.collapsible
        ? this.sourceComponent.getItemLabel(this.schema, this.data, {
            index: this.index,
            asObject: true
          })
        : null
    },

    itemLabel() {
      return this.sourceComponent.getItemLabel(this.schema, this.data, {
        index: this.index
      })
    },

    renderedItem() {
      const { sourceComponent } = this
      return sourceComponent.render(
        new DitoContext(sourceComponent, {
          data: this.data,
          value: this.data,
          index: this.index,
          dataPath: this.dataPath
        })
      )
    }
  }
})
</script>
