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
</style>

<script>
import TypeComponent from '@/TypeComponent'
import NumberMixin from '@/mixins/NumberMixin'
import { getSchemaAccessor } from '@/utils/accessor'
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
