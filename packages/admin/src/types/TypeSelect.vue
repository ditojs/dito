<template lang="pug">
  // In order to make an arrow appear over the select item, we need nesting:
  .dito-select
    select(
      ref="element"
      :id="dataPath"
      v-model="selectValue"
      v-validate="validations"
      v-bind="attributes"
      v-on="listeners"
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
          )
            | {{ getLabelForOption(opt) }}
        option(
          v-else
          :value="getValueForOption(option)"
        )
          | {{ getLabelForOption(option) }}
</template>

<style lang="sass">
.dito
  // TODO: Move to dito-ui
  .dito-select
    display: inline-block
    position: relative
    select
      padding-right: 2.5em
    // Handle .dito-fill separately due to required nesting in .dito-select
    &.dito-fill
      display: block
      select
        width: 100%
    &::after
      +arrow($select-arrow-size)
      bottom: 2px
      right: $select-right-margin
    &.dito-disabled::after
      border-color: $border-color
</style>

<script>
import TypeComponent from '@/TypeComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

// @vue/component
export default TypeComponent.register('select', {
  mixins: [OptionsMixin],

  nativeField: true
})
</script>
