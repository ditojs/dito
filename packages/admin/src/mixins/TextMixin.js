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
    return schema.trim && value != null ? value.trim() : value
  }
}
