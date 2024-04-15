import { isString } from '@ditojs/utils'
import { getDefaultValue } from '../utils/schema.js'
import { getSchemaAccessor } from '../utils/accessor.js'

// @vue/component
export default {
  computed: {
    trim: getSchemaAccessor('trim', {
      type: Boolean,
      default: false
    })
  },

  processValue(context) {
    let { schema, value } = context
    if (schema.trim && value != null && isString(value)) {
      // Text fields don't necessarily have a `String` value when `format()`
      // without `parse()` is used.
      value = value.trim()
    }
    if (value === '') {
      value = getDefaultValue(schema, context)
    }
    return value
  }
}
