<template lang="pug">
//- Set `@click.stop` to prevent click events from bubbling to dito-label.
DitoButtons.dito-edit-buttons(
  :class="{ 'dito-buttons--round': round }"
  :buttons="buttons"
  :dataPath="dataPath"
  :data="data"
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
import { computed } from 'vue'
import { DitoButton } from '@ditojs/ui/src'
import { capitalize } from '@ditojs/utils'
import DitoDragHandle from './DitoDragHandle.vue'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { getVerbs } from '../utils/services.ts'
import { isInlined } from '../utils/schema/structure.js'

export default {
  components: { DitoButton, DitoDragHandle },
  emits: ['delete', 'move'],

  props: {
    buttons: { type: Object, default: null },
    // The owning source or select, which the flag props are resolved from:
    schema: { type: Object, required: true },
    // The form of the item, which can disable the buttons of its items:
    formSchema: { type: Object, default: null },
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null },
    store: { type: Object, required: true },
    nested: { type: Boolean, default: false },
    disabled: { type: Boolean, required: true },
    draggable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    creatable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null },
    editQuery: { type: Object, default: null },
    createPath: { type: String, default: null },
    insertIndex: { type: Number, default: null },
    // Round in lists and objects, square and compact in the rows of trees:
    round: { type: Boolean, default: true }
  },

  setup(props) {
    const { context, services } = useSchemaContext(props)
    const { getSchemaValue, getLabel } = useSchemaValue(context)
    const verbs = computed(() => getVerbs(services))

    // Forms can disable each option with `false` or a callback returning it:
    const hasFormOption = name => (
      !props.formSchema ||
      getSchemaValue(name, {
        schema: props.formSchema,
        type: Boolean,
        default: true
      })
    )

    return {
      verbs,

      editRoute: computed(() => {
        const { editPath, editQuery } = props
        return editPath
          ? { path: editPath, query: editQuery ?? undefined }
          : {}
      }),

      isDraggableDisabled: computed(
        () => props.disabled || !hasFormOption('draggable')
      ),

      isDeletableDisabled: computed(
        () => props.disabled || !hasFormOption('deletable')
      ),

      isEditableDisabled: computed(
        () => props.disabled || !props.editPath || !hasFormOption('editable')
      ),

      isCreatableDisabled: computed(
        () => (
          props.disabled ||
          // Inlined sources create their items in place, without a route:
          !props.createPath && !isInlined(props.schema) ||
          !hasFormOption('creatable')
        )
      ),

      createButtonText: computed(() => {
        const formLabel = getLabel(props.schema.form)
        return (
          // Allow schema to override create button through creatable object:
          props.schema.creatable?.label ||
          // Derive the label from the form label for sources with one form:
          (formLabel && `${capitalize(verbs.value.create)} ${formLabel}`) ||
          null
        )
      })
    }
  }
}
</script>

<style lang="scss">
.dito-edit-buttons {
  // Override cursor from collapsible dito-label:
  cursor: default;
  flex: none;
}
</style>
