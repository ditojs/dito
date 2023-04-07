<template lang="pug">
.dito-slider
  input.dito-range(
    :id="dataPath"
    ref="element"
    v-model="inputValue"
    type="range"
    v-bind="attributes"
    :min="min"
    :max="max"
    :step="stepValue"
  )
  InputField.dito-number(
    v-if="input"
    v-model="inputValue"
    type="number"
    v-bind="attributes"
    :min="min"
    :max="max"
    :step="stepValue"
  )
</template>

<script>
import TypeComponent from '../TypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { InputField } from '@ditojs/ui/src'

// @vue/component
export default TypeComponent.register('slider', {
  mixins: [NumberMixin],
  components: { InputField },
  nativeField: true,

  computed: {
    // TODO: Rename to `showInput`?
    input: getSchemaAccessor('input', {
      type: Boolean,
      default: true
    })
  }
})
</script>

<style lang="sass">
@import '../styles/_imports'

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
