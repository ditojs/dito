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
    v-if="draggable"
    :class="{ 'dito-disabled': isDraggableDisabled }"
    v-bind="getButtonAttributes(verbs.drag)"
  )
  RouterLink.dito-button(
    v-if="editable"
    :class="{ 'dito-disabled': isEditableDisabled }"
    :to="editPath ? { path: editPath } : {}"
    v-bind="getButtonAttributes(verbs.edit)"
  )
  DitoCreateButton(
    v-if="creatable"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :path="createPath"
    :verb="verbs.create"
    :text="createButtonText"
    :disabled="isCreatableDisabled"
  )
  button.dito-button(
    v-if="deletable"
    type="button"
    :disabled="isDeletableDisabled"
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

    isDraggableDisabled() {
      return this.disabled || !this.hasSchemaOption('draggable')
    },

    isDeletableDisabled() {
      return this.disabled || !this.hasSchemaOption('deletable')
    },

    isCreatableDisabled() {
      return (
        this.disabled ||
        !this.createPath ||
        !this.hasSchemaOption('creatable')
      )
    },

    isEditableDisabled() {
      return (
        this.disabled ||
        !this.editPath ||
        !this.hasSchemaOption('editable')
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
    hasSchemaOption(name) {
      // All options can be disabled on a per-form basis by setting
      // `schema[name]` to `false` or a callback returning `false`.
      return this.getSchemaValue(name, {
        type: Boolean,
        default: true
      })
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
