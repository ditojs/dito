<template lang="pug">
//- Inlined items render their form, others the source's `component`, or the
//- label that the source renders for them.
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
  v-html="labelHtml"
)
</template>

<script>
import { computed, h, provide } from 'vue'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { isInlined } from '../utils/schema/structure.js'
import { schemaLayoutKey, sourceSchemaKey } from '../utils/keys.ts'
import { getHtml } from '../utils/html.js'

export default {
  emits: ['delete', 'move'],

  props: {
    // The list or object source that holds the item:
    schema: { type: Object, required: true },
    // The form of the item, which inlined items render:
    formSchema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    // `null` in object sources:
    index: { type: Number, default: null },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    // The remaining props only apply to inlined items:
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    editPath: { type: String, default: null },
    createPath: { type: String, default: null },
    insertIndex: { type: Number, default: null }
  },

  setup(props, { slots }) {
    // The form of the item displays an item of the source:
    provide(
      sourceSchemaKey,
      computed(() => props.schema)
    )
    const { createContext, services } = useSchemaContext(props)
    const label = computed(() =>
      services.sourceContext.getSourceItemLabel(props.data, props.index)
    )
    // For the custom components that render the items, and the slots of
    // `DitoListField` and `DitoObjectField`:
    const context = createContext()
    // For the components that lay out the forms of inlined items:
    const formContext = createContext({
      get schema() {
        return props.formSchema
      }
    })
    // The layout of inlined items: the component of their form, or the widgets
    // of `DitoListField` and `DitoObjectField`, with the context of the item:
    provide(
      schemaLayoutKey,
      computed(() =>
        props.formSchema.component
          ? () =>
              h(props.formSchema.component, {
                schema: props.formSchema,
                context: formContext
              })
          : slots.default
            ? () => slots.default({ context })
            : null
      )
    )
    return {
      context,
      isInlined: computed(() => isInlined(props.schema)),
      label,
      labelHtml: computed(() => getHtml(label.value))
    }
  }
}
</script>
