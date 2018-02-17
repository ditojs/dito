<template lang="pug">
  // In order to make an arrow appear over the select item, we need nesting:
  .dito-select
    select(
      :id="dataPath"
      :name="dataPath"
      :title="label"
      v-model="selectValue"
      v-validate="validations"
      :data-vv-as="label"
      :disabled="disabled"
    )
      template(
        v-for="option in options"
      )
        optgroup(
          v-if="groupBy"
          :label="option[groupLabelKey]"
        )
          option(
            v-for="opt in option[groupOptionsKey]"
            :value="optionToValue(opt)"
          )
            | {{ optionToLabel(opt) }}
        option(
          v-else
          :value="optionToValue(option)"
        )
          | {{ optionToLabel(option) }}
</template>

<style lang="sass">
.dito
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

export default TypeComponent.register('select', {
  mixins: [OptionsMixin]
})
</script>
