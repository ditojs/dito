<template lang="pug">
//- The edit button of an option of an editable options component, which
//- navigates to the form of the option in the view of `schema.view`. It's never
//- disabled, even if the component is disabled. The props come from the
//- options component, which renders it only when it's editable.
DitoEditButtons.dito-options-edit-buttons(
  :schema="schema"
  :dataPath="dataPath"
  :data="data"
  :meta="meta"
  :store="store"
  :disabled="false"
  editable
  :editPath="editPath"
)
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoEditButtons from './DitoEditButtons.vue'
import { getViewEditPath } from '../utils/schema/lookup.js'

// @vue/component
export default DitoComponent.component('DitoOptionsEditButtons', {
  components: { DitoEditButtons },

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    // The context of the options component, to resolve `schema.view`. Not
    // named `context`, which is the component's own context, see DitoMixin.
    parentContext: { type: Object, required: true },
    // The value of the option to edit, e.g. its id.
    optionValue: { type: null, default: null }
  },

  computed: {
    editPath() {
      const { schema, optionValue, parentContext } = this
      return optionValue != null
        ? getViewEditPath(schema, optionValue, parentContext)
        : null
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-options-edit-buttons {
  margin-left: $form-spacing-half;
}
</style>
