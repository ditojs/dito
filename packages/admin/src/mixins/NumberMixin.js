import { getSchemaAccessor } from '../utils/accessor.js'
import { getSchemaValue } from '../utils/schema/data.js'
import { isArray } from '@ditojs/utils'

// @vue/component
export default {
  getTypeValidations(schema, context) {
    // Mirrors the `min`, `max`, `range`, `step` and `decimals` accessors below,
    // but based on the schema alone, so they can be used without a component.
    const isInteger = schema.type === 'integer'
    const getNumberSchemaValue = key =>
      getSchemaValue(key, { type: Number, schema, context })
    const roundIfInteger = (value, roundFunction) =>
      isInteger && value != null ? roundFunction(value) : value
    const range = getSchemaValue('range', { type: Array, schema, context })
    const min = roundIfInteger(
      getNumberSchemaValue('min') ?? range?.[0],
      Math.floor
    )
    const max = roundIfInteger(
      getNumberSchemaValue('max') ?? range?.[1],
      Math.ceil
    )
    const step = roundIfInteger(getNumberSchemaValue('step'), Math.ceil)
    const decimals = getNumberSchemaValue('decimals')
    const validations = {}
    if (min != null && max != null) {
      validations.range = [min, max]
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
      const stepDecimals = (`${step}`.split('.')[1] || '').length
      if (stepDecimals > 0) {
        validations.decimals = stepDecimals
      } else {
        validations.integer = true
      }
    }
    if (isInteger) {
      validations.integer = true
    }
    return validations
  },

  computed: {
    inputValue: {
      get() {
        return this.value !== null ? this.value : ''
      },

      set(value) {
        this.value =
          value !== ''
            ? this.isInteger
              ? Number(value)
              : parseFloat(value)
            : null
      }
    },

    // @overridable
    isInteger() {
      return false
    },

    stepValue() {
      // Don't show steps if the input is also clearable, since the step buttons
      // would collide with the clear button.
      return this.step == null && !this.isInteger
        ? 'any'
        : this.step
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
        min =
          min === undefined
            ? this.getSchemaValue('range', { type: Array })?.[0]
            : min
        return this.isInteger && min != null ? Math.floor(min) : min
      }
    }),

    max: getSchemaAccessor('max', {
      type: Number,
      get(max) {
        max =
          max === undefined
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
          ;[this.min, this.max] = range
        }
      }
    })
  }
}
