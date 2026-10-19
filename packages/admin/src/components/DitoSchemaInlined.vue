<template lang="pug">
DitoSchema.dito-schema-inlined(
  :schema="schema"
  :dataPath="dataPath"
  :data="data"
  :store="store"
  :label="isCompact ? null : label"
  :info="info"
  :padding="padding ?? 'inlined'"
  :inlined="true"
  :disabled="disabled"
  :compact="isCompact"
  :collapsed="collapsed"
  :collapsible="collapsible"
  :generateLabels="!isCompact"
  @toggle="collapsed => $emit('toggle', collapsed)"
)
  template(
    v-if="$slots.default"
    #default
  )
    slot
  //- The edit buttons take the schema of the list or object that holds the
  //- item, while `schema` is the item's form. The schema passes their class:
  template(#edit-buttons="{ class: buttonsClass }")
    DitoEditButtons(
      v-if="deletable || draggable || editable || insertIndex != null"
      :class="buttonsClass"
      :schema="sourceContext.schema"
      :formSchema="schema"
      :dataPath="dataPath"
      :data="data"
      :store="store"
      :disabled="disabled"
      :deletable="deletable"
      :draggable="draggable"
      :editable="editable"
      :editPath="editPath"
      :creatable="insertIndex != null"
      :createPath="createPath"
      :insertIndex="insertIndex"
      @delete="$emit('delete')"
      @move="delta => $emit('move', delta)"
    )
</template>

<script>
import { computed } from 'vue'
import { useServices } from '../composables/useSchemaContext.ts'
import { isCompact } from '../utils/schema/structure.js'

export default {
  emits: ['delete', 'move', 'toggle'],

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    store: { type: Object, required: true },
    label: { type: [String, Object], default: null },
    info: { type: [String, Object], default: null },
    padding: { type: String, default: null },
    disabled: { type: Boolean, required: true },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null },
    createPath: { type: String, default: null },
    insertIndex: { type: Number, default: null }
  },

  setup(props) {
    const services = useServices()
    return {
      sourceContext: computed(() => services.sourceContext),
      isCompact: computed(() => isCompact(props.schema))
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-schema-inlined {
  // Use grid layout for two reasons: For `TransitionHeight` to work smoothly,
  // and to align the header above the content.
  display: grid;
  grid-template-rows: min-content;
  grid-template-columns: 100%;

  // Show the buttons other than edit and remove only on hover, hidden but
  // keeping their space so that the header doesn't shift:
  @media (hover: hover) {
    &:not(:hover, :focus-within) {
      > .dito-schema-header
        .dito-button:not(.dito-button--edit, .dito-button--remove) {
        visibility: hidden;
      }
    }
  }
}
</style>
