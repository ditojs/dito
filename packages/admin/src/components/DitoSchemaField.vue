<template lang="pug">
DitoContainer(
  v-if="entry.shouldRender"
  :schema="entry.schema"
  :dataPath="entry.dataPath"
  :data="pane.data"
  :itemDataPath="entry.itemDataPath"
  :store="entry.store"
  :nested="entry.nested"
  :disabled="pane.disabled"
  :compact="pane.compact"
  :generateLabels="pane.generateLabels"
)
  //- The content of the field's custom component:
  template(
    v-if="$slots.default"
    #default
  )
    slot
</template>

<script>
import { computed, inject } from 'vue'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { layoutKey } from '../utils/keys.ts'

// Places a component of a layout section, as its pane would render it:
const DitoSchemaField = {
  props: {
    name: { type: String, required: true }
  },

  setup(props) {
    const layout = inject(layoutKey, null)
    if (!layout) {
      throw new Error(
        `Unable to place '${props.name}' outside of sections with 'component'.`
      )
    }
    // Fields in the slots of other fields continue the path of the pane:
    useComponentPath(
      () => layout.props.dataPath,
      () => layout.componentPath.value
    )
    return {
      pane: layout.props,
      entry: computed(() => layout.getEntry(props.name))
    }
  }
}

export default DitoSchemaField
</script>
