<template lang="pug">
//- The edit button of an option of an editable options component, which
//- navigates to the form of the option in the view of `schema.view`. It's never
//- disabled, even if the component is disabled.
DitoEditButtons.dito-options-edit-buttons(
  v-if="typeComponent.editable"
  :schema="typeComponent.schema"
  :dataPath="typeComponent.dataPath"
  :data="typeComponent.data"
  :meta="typeComponent.meta"
  :store="typeComponent.store"
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
    typeComponent: { type: Object, required: true },
    // The value of the option to edit, e.g. its id.
    optionValue: { type: null, default: null }
  },

  computed: {
    editPath() {
      const { schema, context } = this.typeComponent
      return this.optionValue != null
        ? getViewEditPath(schema, this.optionValue, context)
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
