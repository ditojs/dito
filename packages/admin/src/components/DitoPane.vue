<template lang="pug">
DitoPaneRows.dito-pane--layout(
  :entries="entries"
  :data="pane.data"
  :disabled="pane.disabled"
  :compact="pane.compact"
  :generateLabels="pane.generateLabels"
)
</template>

<script>
import { computed, inject } from 'vue'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { layoutKey } from '../utils/keys.ts'

// Places components of a layout section in rows, as its pane would render
// them:
export default {
  props: {
    names: { type: Array, default: null }
  },

  setup(props) {
    const layout = inject(layoutKey, null)
    if (!layout) {
      throw new Error(
        `Unable to place panes outside of sections with 'component'.`
      )
    }
    // Panes in the slots of fields continue the path of the layout's pane:
    useComponentPath(
      () => layout.props.dataPath,
      () => layout.componentPath.value
    )
    return {
      pane: layout.props,
      entries: computed(() =>
        props.names
          ? props.names.map(name => layout.getEntry(name))
          : layout.entries.value
      )
    }
  }
}
</script>
