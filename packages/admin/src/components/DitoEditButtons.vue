<template lang="pug">
//- Set `@click.stop` to prevent click events from bubbling to dito-label.
DitoButtons.dito-edit-buttons.dito-buttons--round(
  :buttons="buttons"
  :dataPath="dataPath"
  :data="data"
  :meta="meta"
  :store="store"
  :nested="nested"
  :disabled="disabled"
  @click.stop
)
  DitoDragHandle(
    v-if="draggable"
    :disabled="isDraggableDisabled"
    @move="delta => $emit('move', delta)"
  )
  DitoButton(
    v-if="editable"
    as="RouterLink"
    :to="editRoute"
    :verb="verbs.edit"
    :disabled="isEditableDisabled"
  )
  DitoCreateButton(
    v-if="creatable"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :nested="nested"
    :path="createPath"
    :verb="verbs.create"
    :text="insertIndex != null ? null : createButtonText"
    :disabled="isCreatableDisabled"
    :insertIndex="insertIndex"
  )
  DitoButton(
    v-if="deletable"
    :verb="verbs.delete"
    :disabled="isDeletableDisabled"
    @click="$emit('delete')"
  )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoDragHandle from './DitoDragHandle.vue'
import ContextMixin from '../mixins/ContextMixin.js'
import { DitoButton } from '@ditojs/ui/src'
import { capitalize } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoEditButtons', {
  mixins: [ContextMixin],
  components: { DitoButton, DitoDragHandle },
  emits: ['delete', 'move'],

  props: {
    buttons: { type: Object, default: null },
    // The schema of the component that owns the buttons, e.g. the list or
    // object source, or the select. The `draggable`, `editable`, `creatable`
    // and `deletable` props are already resolved from it.
    schema: { type: Object, required: true },
    // The form schema of the item that per-item buttons act on, which can
    // disable the buttons for its items, see `hasFormOption()`.
    formSchema: { type: Object, default: null },
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    nested: { type: Boolean, default: false },
    disabled: { type: Boolean, required: true },
    draggable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    creatable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null },
    // The query of the edit route, e.g. to keep the current one in trees.
    editQuery: { type: Object, default: null },
    createPath: { type: String, default: null },
    insertIndex: { type: Number, default: null }
  },

  computed: {
    formLabel() {
      return this.getLabel(this.schema.form)
    },

    editRoute() {
      const { editPath, editQuery } = this
      return editPath ? { path: editPath, query: editQuery ?? undefined } : {}
    },

    isDraggableDisabled() {
      return this.disabled || !this.hasFormOption('draggable')
    },

    isDeletableDisabled() {
      return this.disabled || !this.hasFormOption('deletable')
    },

    isEditableDisabled() {
      return (
        this.disabled ||
        !this.editPath ||
        !this.hasFormOption('editable')
      )
    },

    isCreatableDisabled() {
      return (
        this.disabled ||
        !this.createPath ||
        !this.hasFormOption('creatable')
      )
    },

    createButtonText() {
      return (
        // Allow schema to override create button through creatable object:
        this.schema.creatable?.label || (
          // Auto-generate create button labels from from labels for list
          // sources with only one form:
          this.formLabel &&
          `${capitalize(this.verbs.create)} ${this.formLabel}`
        ) ||
        null
      )
    }
  },

  methods: {
    hasFormOption(name) {
      // All options can be disabled on a per-form basis by setting
      // `formSchema[name]` to `false` or a callback returning `false`.
      return (
        !this.formSchema ||
        this.getSchemaValue(name, {
          schema: this.formSchema,
          type: Boolean,
          default: true
        })
      )
    }
  }
})
</script>

<style lang="scss">
.dito-edit-buttons {
  // Override cursor from collapsible dito-label:
  cursor: default;
  flex: none;
}
</style>
