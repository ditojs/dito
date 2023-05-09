import { isString } from '@ditojs/utils'
import { getSchemaAccessor } from '../utils/accessor.js'

// @vue/component
export default {
  computed: {
    trim: getSchemaAccessor('trim', {
      type: Boolean,
      default: false
    })
  },

  processValue(schema, value) {
    if (schema.trim && value != null && isString(value)) {
      // Text fields don't necessarily have a `String` value when `format()`
      // without `parse()` is used.
      value = value.trim()
    }
    return value
  }
}
