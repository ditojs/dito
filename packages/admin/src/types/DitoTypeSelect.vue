<template lang="pug">
//- Nesting is needed to make an arrow appear over the select item:
.dito-select
  .dito-select__inner
    DitoInputAffixes(
      position="prefix"
      v-bind="inputAffixesProps.prefix"
      absolute
    )
    select(
      :id="componentPath"
      ref="element"
      v-model="selectedValue"
      v-bind="attributes"
    )
      //- Plain values whose option disappeared are kept and shown as
      //- unavailable, rather than cleared without the user noticing:
      option(
        v-if="shouldShowUnavailableValue"
        :value="selectedValue"
        disabled
      ) {{ getLabelForOption(selectedValue) }} (unavailable)
      template(
        v-for="option in options"
      )
        optgroup(
          v-if="isGrouped"
          :label="option.label"
        )
          option(
            v-for="opt in option.options"
            :value="getValueForOption(opt)"
          ) {{ getLabelForOption(opt) }}
        option(
          v-else
          :value="getValueForOption(option)"
        ) {{ getLabelForOption(option) }}
    DitoInputAffixes(
      position="suffix"
      v-bind="inputAffixesProps.suffix"
      absolute
      @clear="clear"
    )
  DitoOptionsEditButtons(
    v-if="editable"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :store="store"
    :optionValue="selectedValue"
  )
</template>

<script>
import { computed } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { optionsTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useOptions } from '../composables/useOptions.ts'
import { useServices } from '../composables/useSchemaContext.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'

// @vue/component
const DitoTypeSelect = {
  name: 'DitoTypeSelect',
  components: { DitoInputAffixes, DitoOptionsEditButtons },
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
    const { hasOptions, selectedValue, findOptionForValue } = optionsField
    return {
      ...field,
      ...optionsField,

      // Only plain values stay when their option disappears, see
      // `getReplacedValue()`. The select matches objects by deep equality.
      shouldShowUnavailableValue: computed(() => {
        const selected = selectedValue.value
        return (
          selected != null &&
          typeof selected !== 'object' &&
          hasOptions.value &&
          !findOptionForValue(selected)
        )
      })
    }
  }
}

defineType({
  type: 'select',
  component: DitoTypeSelect,
  ...optionsTraits
})

export default DitoTypeSelect
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-select {
  display: inline-flex;
  position: relative;

  select {
    @extend %input;

    padding-right: $select-arrow-width;
  }

  // `&___inner` is needed to make the edit buttons appear to the right of the
  // select:
  &__inner {
    flex: 1;
    position: relative;

    &::before {
      @include arrow($select-arrow-size);

      position: absolute;
      bottom: $select-arrow-bottom;
      right: $select-arrow-right;

      .dito-container--disabled & {
        border-color: $color-disabled;
      }
    }
  }

  // Handle width fill separately due to required nesting of select:
  &.dito-component--fill {
    select {
      width: 100%;
    }
  }
}
</style>
