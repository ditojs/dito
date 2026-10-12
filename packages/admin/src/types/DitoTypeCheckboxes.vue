<template lang="pug">
DitoOptionList.dito-checkboxes(
  :id="componentPath"
  role="group"
  :aria-label="label"
  :options="options"
  :isGrouped="isGrouped"
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
import { defineType } from '../utils/schema/types.ts'
import { optionsTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useOptions } from '../composables/useOptions.ts'
import { useServices } from '../composables/useSchemaContext.ts'
import DitoOptionList from '../components/DitoOptionList.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'
import { getMultipleValue } from '../utils/schema/data.js'

// @vue/component
const DitoTypeCheckboxes = {
  name: 'DitoTypeCheckboxes',
  components: { DitoOptionList, DitoOptionsEditButtons },
  props: fieldProps,

  setup(props) {
    const field = useField(props, {
      nativeField: true,
      // The contexts of the field hold its options:
      services: useServices({
        get options() {
          return optionsField.options.value
        }
      })
    })
    const optionsField = useOptions(props, field)
    const { multiple, selectedValue } = optionsField
    return {
      ...field,
      ...optionsField,

      // An array for the `v-model` of checkboxes, also with `multiple: false`:
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
          // Uncheck the checked one, as the `v-model` appends checked values:
          selectedValue.value = multiple.value
            ? values
            : (values.at(-1) ?? null)
        }
      })
    }
  }
}

defineType({
  type: 'checkboxes',
  component: DitoTypeCheckboxes,
  ...optionsTraits,
  defaultValue: context =>
    getMultipleValue(context.schema, context) ? [] : null,
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
