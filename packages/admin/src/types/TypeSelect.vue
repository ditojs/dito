<template lang="pug">
  //- Nesting is needed to make an arrow appear over the select item:
  .dito-select
    select(
      ref="element"
      :id="dataPath"
      v-model="selectedValue"
      v-bind="attributes"
      v-on="listeners"
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
        option(
          :value="selectedValue"
        ) {{ getLabelForOption(selectedOption) }}
    button.dito-button-clear.dito-button-overlay(
      v-if="showClearButton"
      @click="clear"
      :disabled="disabled"
    )
</template>

<style lang="sass">
  // TODO: Move to dito-ui
  $select-arrow-right: calc(($select-arrow-width - $select-arrow-size) / 2)

  .dito-select
    display: inline-block
    position: relative

    select
      padding-right: $select-arrow-width

    // Handle .dito-width-fill separately due to required nesting of select:
    &.dito-width-fill
      select
        width: 100%

    &::after
      position: absolute
      +arrow($select-arrow-size)
      bottom: $select-arrow-bottom
      right: calc(#{$select-arrow-right} + #{$border-width})

    &.dito-disabled::after
      border-color: $border-color
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'

// @vue/component
export default TypeComponent.register('select', {
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
