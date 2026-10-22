<template lang="pug">
//- Edit the option in the view of `schema.view`. It's never disabled, even if
//- the options component is.
DitoEditButtons.dito-options-edit-buttons(
  :schema="schema"
  :dataPath="dataPath"
  :data="data"
  nested
  :store="store"
  :disabled="false"
  editable
  :editPath="editPath"
)
</template>

<script>
import { computed, inject } from 'vue'
import DitoEditButtons from './DitoEditButtons.vue'
import { adminContextKey } from '../utils/keys.ts'

export default {
  components: { DitoEditButtons },

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null },
    store: { type: Object, required: true },
    optionValue: { type: null, default: null }
  },

  setup(props) {
    const adminContext = inject(adminContextKey)
    return {
      editPath: computed(() => {
        const { schema, optionValue } = props
        return optionValue != null
          ? (adminContext.routeTree?.getViewItemPath(
              schema.view,
              String(optionValue)
            ) ?? null)
          : null
      })
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-options-edit-buttons {
  margin-left: $form-spacing-half;
}
</style>
