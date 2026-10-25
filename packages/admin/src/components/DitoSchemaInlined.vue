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
  :bordered="bordered"
  :disabled="disabled"
  :compact="isCompact"
  :collapsed="collapsed"
  :collapsible="collapsible"
  :generateLabels="!isCompact"
  :idle="isIdle"
  @toggle="collapsed => $emit('toggle', collapsed)"
  @mouseenter="isHovered = true"
  @mouseleave="isHovered = false"
  @focusin="hasFocus = true"
  @focusout="onFocusOut"
)
  //- The edit buttons take the schema of the list or object that holds the
  //- item, while `schema` is the item's form. The schema passes their class,
  //- and whether they are idle in its header:
  template(#edit-buttons="{ class: buttonsClass, idle }")
    DitoEditButtons(
      v-if="deletable || draggable || editable || insertIndex != null"
      :class="buttonsClass"
      :idle="idle"
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
import { computed, ref } from 'vue'
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
    bordered: { type: Boolean, default: false },
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
    // Render the buttons other than edit and remove only while the item is
    // hovered or holds the focus, or always on devices without hover:
    const hasHover = !window.matchMedia('(hover: none)').matches
    const isHovered = ref(false)
    const hasFocus = ref(false)
    return {
      sourceContext: computed(() => services.sourceContext),
      isCompact: computed(() => isCompact(props.schema)),
      isHovered,
      hasFocus,
      isIdle: computed(() => hasHover && !isHovered.value && !hasFocus.value),

      onFocusOut(event) {
        hasFocus.value = event.currentTarget.contains(event.relatedTarget)
      }
    }
  }
}
</script>

<style lang="scss">
.dito-schema-inlined {
  // Use grid layout for two reasons: For `TransitionHeight` to work smoothly,
  // and to align the header above the content.
  display: grid;
  grid-template-rows: min-content;
  grid-template-columns: 100%;
}
</style>
