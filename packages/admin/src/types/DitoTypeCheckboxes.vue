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
      :store="store"
      :optionValue="getValueForOption(option)"
    )
</template>

<script>
import { computed } from 'vue'
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { optionsTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useOptions } from '../composables/useOptions.ts'
import DitoOptionList from '../components/DitoOptionList.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'
import { getMultipleValue } from '../utils/schema/data.js'

// @vue/component
const DitoTypeCheckboxes = DitoComponent.component('DitoTypeCheckboxes', {
  components: { DitoOptionList, DitoOptionsEditButtons },
  props: fieldProps,

  setup(props) {
    const field = useField(props, { nativeField: true })
    const {
      options,
      groupBy,
      editable,
      multiple,
      selectedValue,
      getValueForOption,
      getLabelForOption
    } = useOptions(props, field)
    return {
      attributes: field.attributes,
      focus: field.focus,
      options,
      groupBy,
      editable,
      getValueForOption,
      getLabelForOption,

      // The values of the checked checkboxes, as an array for their `v-model`,
      // also with `multiple: false`.
      checkedValues: computed({
        get() {
          const selected = selectedValue.value
          return multiple.value
            ? (selected || []).filter(value => value != null)
            : selected != null
              ? [selected]
              : []
        },

        set(values) {
          // With `multiple: false`, checking a checkbox unchecks the checked
          // one, as the `v-model` of checkboxes appends checked values.
          selectedValue.value = multiple.value
            ? values
            : (values.at(-1) ?? null)
        }
      })
    }
  }
})

defineType({
  types: ['checkboxes'],
  component: DitoTypeCheckboxes,
  ...optionsTraits,
  defaultValue: ({ schema }) => (getMultipleValue(schema) ? [] : null),
  defaultWidth: 'auto',
  defaultMultiple: true
})

export default DitoTypeCheckboxes
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
