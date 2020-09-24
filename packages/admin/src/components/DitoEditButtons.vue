<template lang="pug">
  dito-buttons.dito-edit-buttons.dito-buttons-round(
    :buttons="buttons"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    /* Prevent click events from bubbling to dito-label: */
    @click.stop
  )
    // Firefox doesn't like <button> here, so use <a> instead:
    a.dito-button(
      v-if="draggable"
      v-bind="getButtonAttributes(verbs.drag)"
    )
    router-link.dito-button(
      v-if="editable && editPath"
      :to="{ path: editPath }" append
      v-bind="getButtonAttributes(verbs.edit)"
    )
    dito-create-button(
      v-if="creatable && createPath"
      :schema="schema"
      :path="createPath"
      :verb="verbs.create"
      :text="createButtonText"
    )
    button.dito-button(
      v-if="deletable"
      type="button"
      v-bind="getButtonAttributes(verbs.delete)"
      @click="$emit('delete')"
    )
</template>

<style lang="sass">
  .dito-edit-buttons
    // Override cursor from collapsible dito-label:
    cursor: default
    flex: none
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { capitalize } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-edit-buttons', {
  props: {
    draggable: { type: [Object, Boolean], default: false },
    editable: { type: Boolean, default: false },
    creatable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null },
    createPath: { type: String, default: null },
    buttons: { type: Object, default: null },
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null },
    meta: { type: Object, required: true },
    store: { type: Object, required: true }
  },

  computed: {
    formLabel() {
      return this.getLabel(this.schema.form)
    },

    createButtonText() {
      return (
        // Allow schema to override create button through creatable object:
        this.schema.creatable.label ||
        (
          // Auto-generate create button labels from from labels for list
          // sources with only one form:
          this.formLabel &&
          `${capitalize(this.verbs.create)} ${this.formLabel}`
        ) ||
        null
      )
    }
  }
})
</script>
