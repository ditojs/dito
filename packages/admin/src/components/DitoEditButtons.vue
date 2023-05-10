<template lang="pug">
//- Set `@click.stop` to prevent click events from bubbling to dito-label.
DitoButtons.dito-edit-buttons.dito-buttons-round(
  :buttons="buttons"
  :dataPath="dataPath"
  :data="data"
  :meta="meta"
  :store="store"
  @click.stop
)
  //- Firefox doesn't like <button> here, so use <a> instead:
  a.dito-button(
    v-if="hasDraggable"
    v-bind="getButtonAttributes(verbs.drag)"
  )
  RouterLink.dito-button(
    v-if="hasEditable"
    :class="{ 'dito-disabled': !editPath }"
    :to="editPath ? { path: editPath } : {}"
    v-bind="getButtonAttributes(verbs.edit)"
  )
  DitoCreateButton(
    v-if="hasCreatable"
    :class="{ 'dito-disabled': !createPath }"
    :schema="schema"
    :path="createPath"
    :verb="verbs.create"
    :text="createButtonText"
  )
  button.dito-button(
    v-if="hasDeletable"
    type="button"
    :disabled="!isFormDeletable"
    v-bind="getButtonAttributes(verbs.delete)"
    @click="$emit('delete')"
  )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { capitalize } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoEditButtons', {
  emits: ['delete'],

  props: {
    buttons: { type: Object, default: null },
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    draggable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    creatable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null },
    createPath: { type: String, default: null }
  },

  computed: {
    formLabel() {
      return this.getLabel(this.schema.form)
    },

    hasDraggable() {
      return this.hasOption('draggable')
    },

    hasEditable() {
      return this.hasOption('editable')
    },

    hasCreatable() {
      return this.hasOption('creatable')
    },

    hasDeletable() {
      return this.hasOption('deletable')
    },

    isFormDeletable() {
      return this.schema.deletable !== false
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
    hasOption(name) {
      // The options of the outer component are passed to the buttons component
      // through properties `this[name]`, but can be disabled on a per-form
      // basis by setting `schema[name]` to `false`.
      return !!(this[name] && this.schema[name] !== false)
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
