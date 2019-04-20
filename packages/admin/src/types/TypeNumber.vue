<template lang="pug">
  input-field.dito-number(
    ref="element"
    :id="dataPath"
    type="number"
    v-model="inputValue"
    v-validate="validations"
    v-bind="attributes"
    v-on="listeners"
    :min="min"
    :max="max"
    :step="stepValue"
  )
</template>

<style lang="sass">
.dito
  // Only show spin buttons if the number component defines a step size.
  input[type="number"]:not([step])
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button
      -webkit-appearance: none
      margin: 0
</style>

<script>
import TypeComponent from '@/TypeComponent'
import { InputField } from '@ditojs/ui'
import { getSchemaAccessor } from '@/utils/accessor'
import { isArray } from '@ditojs/utils'

export default TypeComponent.register([
  'number', 'integer'
],
// @vue/component
{
  components: { InputField },
  nativeField: true,
  textField: true,

  computed: {
    inputValue: {
      get() {
        return this.value !== null ? this.value : ''
      },

      set(value) {
        this.value = value !== ''
          ? this.isInteger ? parseInt(value, 10) : parseFloat(value)
          : null
      }
    },

    isInteger() {
      return this.type === 'integer'
    },

    stepValue() {
      return this.step == null && !this.isInteger ? 'any' : this.step
    },

    decimals: getSchemaAccessor('decimals', {
      type: Number
    }),

    step: getSchemaAccessor('step', {
      type: Number,
      get(step) {
        // For integers, round the steps to the next bigger integer value:
        return this.isInteger && step != null ? Math.ceil(step) : step
      }
    }),

    min: getSchemaAccessor('min', {
      type: Number,
      get(min) {
        min = min === undefined
          ? this.getSchemaValue('range', { type: Array })?.[0]
          : min
        return this.isInteger && min != null ? Math.floor(min) : min
      }
    }),

    max: getSchemaAccessor('max', {
      type: Number,
      get(max) {
        max = max === undefined
          ? this.getSchemaValue('range', { type: Array })?.[1]
          : max
        return this.isInteger && max != null ? Math.ceil(max) : max
      }
    }),

    range: getSchemaAccessor('range', {
      type: Array,
      get() {
        // `this.min`, `this.max` already support `schema.range`,
        // so redirect there.
        const { min, max } = this
        return min != null && max != null ? [min, max] : undefined
      },

      set(range) {
        // Provide a setter that delegates to `[this.min, this.max]`,
        // since those already handle `schema.range`.
        if (isArray(range)) {
          [this.min, this.max] = range
        }
      }
    })
  },

  methods: {
    getValidationRules() {
      const rules = {}
      // TODO: Create a base class for all number based types (e.g. TypeSlider)
      // and move these validations there.
      const { range, min, max, decimals, step } = this
      if (range) {
        rules.between = range
      } else {
        if (min != null) {
          rules.min_value = min
        }
        if (max != null) {
          rules.max_value = max
        }
      }
      if (decimals != null) {
        rules.decimal = decimals
      } else if (step) {
        const decimals = (`${step}`.split('.')[1] || '').length
        if (decimals > 0) {
          rules.decimal = decimals
        } else {
          rules.numeric = true
        }
      }
      if (this.isInteger) {
        rules.numeric = true
      }
      return rules
    }
  }
})
</script>
