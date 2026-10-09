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
        template(
          v-for="option in options"
        )
          optgroup(
            v-if="groupBy"
            :label="option[groupByLabel]"
          )
            option(
              v-for="opt in option[groupByOptions]"
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
    :meta="meta"
    :store="store"
    :parentContext="context"
    :optionValue="selectedValue"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { getInputAffixesProps } from '../utils/affixes.js'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'

// @vue/component
export default DitoTypeComponent.register('select', {
  mixins: [OptionsMixin],
  components: { DitoInputAffixes, DitoOptionsEditButtons },

  nativeField: true,

  data() {
    return {
      // Disable lazy-population for now.
      // TODO: Set to `false` Once lineto e2e tests address their issues.
      populate: true
    }
  },

  computed: {
    inputAffixesProps() {
      return getInputAffixesProps(this)
    }
  }
})
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
