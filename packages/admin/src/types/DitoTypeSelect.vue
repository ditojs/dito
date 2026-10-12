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
      @mousedown="populate = true"
      @focus="populate = true"
    )
      template(
        v-if="populate"
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
            v-if="groupBy"
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
      template(
        v-else-if="selectedOption"
      )
        option(:value="selectedValue") {{ getLabelForOption(selectedOption) }}
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
import { computed, ref } from 'vue'
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { optionsTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useOptions } from '../composables/useOptions.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'

// @vue/component
const DitoTypeSelect = DitoComponent.component('DitoTypeSelect', {
  components: { DitoInputAffixes, DitoOptionsEditButtons },
  props: fieldProps,

  setup(props) {
    const field = useField(props, { nativeField: true })
    const {
      options,
      hasOptions,
      groupBy,
      editable,
      selectedValue,
      selectedOption,
      getValueForOption,
      getLabelForOption,
      findOptionForValue
    } = useOptions(props, field)
    return {
      attributes: field.attributes,
      inputAffixesProps: field.inputAffixesProps,
      focus: field.focus,
      clear: field.clear,
      options,
      groupBy,
      editable,
      selectedValue,
      selectedOption,
      getValueForOption,
      getLabelForOption,
      // Lazy population of the options, on focus or mousedown, is disabled
      // since 2019, as lineto's e2e tests chose options without focusing the
      // select first, and found none.
      // TODO: Re-enable it with `false` once e2e tests can handle it.
      populate: ref(true),

      // Whether the value is set but none of the loaded options has it. Values
      // of option objects are replaced with `null` when their option
      // disappears, see `getReplacedValue()`, but plain values match any value,
      // so they stay. Object values without `optionValue` are left to the
      // select, which matches them to their options by deep equality.
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
})

defineType({
  types: ['select'],
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
