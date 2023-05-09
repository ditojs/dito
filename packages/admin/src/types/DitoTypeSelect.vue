<template lang="pug">
//- Nesting is needed to make an arrow appear over the select item:
.dito-select
  .dito-select__inner
    select(
      :id="dataPath"
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
    button.dito-button-clear.dito-button-overlay(
      v-if="showClearButton"
      :disabled="disabled"
      @click="clear"
    )
  DitoEditButtons(
    v-if="editable"
    :editable="editable"
    :editPath="editPath"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'

// @vue/component
export default DitoTypeComponent.register('select', {
  mixins: [OptionsMixin],

  nativeField: true,

  data() {
    return {
      // Disable lazy-population for now.
      // TODO: Set to `false` Once lineto e2e tests address their issues.
      populate: true
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

// TODO: Move to dito-ui
$select-arrow-right: calc(($select-arrow-width - $select-arrow-size) / 2);

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
      right: calc(#{$select-arrow-right} + #{$border-width});
    }
  }

  .dito-edit-buttons {
    margin-left: $form-spacing-half;
  }

  // Handle .dito-width-fill separately due to required nesting of select:
  &.dito-width-fill {
    select {
      width: 100%;
    }
  }

  &.dito-disabled::after {
    border-color: $border-color;
  }
}
</style>
