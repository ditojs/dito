<template lang="pug">
DitoOptionList.dito-checkboxes(
  :id="componentPath"
  role="group"
  :aria-label="label"
  :options="options"
  :isGrouped="!!groupBy"
  :layout="schema.layout"
)
  template(#option="{ option, isFirstOption }")
    label
      .dito-checkbox
        input(
          :ref="isFirstOption ? 'element' : undefined"
          v-model="checkedValues"
          type="checkbox"
          :value="getValueForOption(option)"
          v-bind="attributes"
        )
        span {{ getLabelForOption(option) }}
    DitoOptionsEditButtons(
      v-if="editable"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :parentContext="context"
      :optionValue="getValueForOption(option)"
    )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'
import DitoOptionList from '../components/DitoOptionList.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'
import { getMultipleValue } from '../utils/schema/data.js'

// @vue/component
export default DitoTypeComponent.register('checkboxes', {
  mixins: [OptionsMixin],
  components: { DitoOptionList, DitoOptionsEditButtons },

  nativeField: true,
  defaultValue: ({ schema }) => (getMultipleValue(schema) ? [] : null),
  defaultWidth: 'auto',
  defaultMultiple: true,

  computed: {
    // The values of the checked checkboxes, as an array for their `v-model`,
    // also with `multiple: false`.
    checkedValues: {
      get() {
        const { selectedValue } = this
        return this.multiple
          ? (selectedValue || []).filter(value => value != null)
          : selectedValue != null
            ? [selectedValue]
            : []
      },

      set(values) {
        // With `multiple: false`, checking a checkbox unchecks the checked
        // one, as the `v-model` of checkboxes appends checked values.
        this.selectedValue = this.multiple ? values : (values.at(-1) ?? null)
      }
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-checkboxes {
  label {
    @extend %input-borderless;
  }

  input {
    margin-right: $form-spacing;
  }
}
</style>
