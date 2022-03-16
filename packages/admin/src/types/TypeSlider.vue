<template lang="pug">
  .dito-slider
    input.dito-range(
      ref="element"
      :id="dataPath"
      type="range"
      v-model="inputValue"
      v-bind="attributes"
      v-on="listeners"
      :min="min"
      :max="max"
      :step="stepValue"
    )
    input-field.dito-number(
      v-if="input"
      type="number"
      v-model="inputValue"
      v-bind="attributes"
      v-on="listeners"
      :min="min"
      :max="max"
      :step="stepValue"
    )
</template>

<style lang="sass">
  .dito-slider
    @extend %input
    display: flex
    .dito-range
      flex: auto
      height: calc(1em * var(--line-height))
    .dito-number
      border: 0
      padding: 0
      text-align: right
      font-variant-numeric: tabular-nums
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { InputField } from '@ditojs/ui'

// @vue/component
export default TypeComponent.register('slider', {
  components: { InputField },
  mixins: [NumberMixin],
  nativeField: true,

  computed: {
    input: getSchemaAccessor('input', {
      type: Boolean,
      default: true
    })
  }
})
</script>
