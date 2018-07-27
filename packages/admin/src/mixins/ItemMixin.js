import { isString, isFunction } from '@ditojs/utils'
import { isListSource } from '@/utils/schema'

// @vue/component
export default {
  methods: {
    getItemFormSchema(sourceSchema, item) {
      const { form, forms } = sourceSchema
      const type = item?.type
      return forms && type ? forms[type] : form
    },

    getItemId(sourceSchema, item, index) {
      const { idName = 'id' } = sourceSchema
      const id = this.isTransient ? index : item[idName]
      return id === undefined ? id : String(id)
    },

    getItemLabel(sourceSchema, item, index = null, extended = false) {
      const { itemLabel } = sourceSchema
      if (!extended && itemLabel === false) return null
      const getFormLabel = () =>
        this.getLabel(this.getItemFormSchema(sourceSchema, item))
      let label = null
      if (isFunction(itemLabel)) {
        label = itemLabel.call(
          this,
          item,
          // Only call getFormLabel if callback wants 2nd argument
          itemLabel.length > 1 ? getFormLabel() : undefined
        )
        // It's up to `itemLabel()` entirely to produce the name:
        extended = false
      } else {
        const { columns } = sourceSchema
        // Look up the name on the item, by these rules:
        // 1. If `itemLabel` is a string, use it as the property key
        // 2. Otherwise, if there are columns, use the value of the first
        // 3. Otherwise, see if the item has a property named 'name'
        const key = isString(itemLabel) && itemLabel ||
          columns && Object.keys(columns)[0] ||
          'name'
        label = item[key]
      }
      // If no label was found so far, try to produce one from the id or index.
      if (label == null) {
        const id = this.getItemId(sourceSchema, item)
        label = id ? `(id: ${id})`
          : isListSource(sourceSchema) && index !== null ? `${index + 1}`
          : ''
        extended = true
      } else if (extended) {
        label = `'${label}'`
      }
      return extended
        ? label ? `${getFormLabel()} ${label}` : getFormLabel()
        : label || ''
    }
  }
}
