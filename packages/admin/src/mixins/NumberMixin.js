import { getSchemaAccessor } from '../utils/accessor.js'
import { isArray } from '@ditojs/utils'

// @vue/component
export default {
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

    // @overridable
    isInteger() {
      return false
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
    getValidations() {
      const validations = {}
      const { range, min, max, decimals, step } = this
      if (range) {
        validations.range = range
      } else {
        if (min != null) {
          validations.min = min
        }
        if (max != null) {
          validations.max = max
        }
      }
      if (decimals != null) {
        validations.decimals = decimals
      } else if (step) {
        const decimals = (`${step}`.split('.')[1] || '').length
        if (decimals > 0) {
          validations.decimals = decimals
        } else {
          validations.integer = true
        }
      }
      if (this.isInteger) {
        validations.integer = true
      }
      return validations
    }
  }
}
