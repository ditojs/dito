import { isString, isFunction } from '@ditojs/utils'
import { getItemFormSchema, isListSource } from '@/utils/schema'
import { appendDataPath, getItemParams } from '@/utils/data'

// @vue/component
export default {
  methods: {
    getItemFormSchema,

    getItemId(sourceSchema, item, index) {
      const { idName = 'id' } = sourceSchema
      const id = this.isTransient ? index : item[idName]
      return id === undefined ? id : String(id)
    },

    getItemDataPath(sourceSchema, index) {
      return appendDataPath(
        this.dataPath,
        index != null
          ? `${sourceSchema.name}/${index}`
          : sourceSchema.name
      )
    },

    getItemLabel(sourceSchema, item, index = null, extended = false) {
      const { itemLabel } = sourceSchema
      if (!extended && itemLabel === false) return null
      const getFormLabel = () =>
        this.getLabel(getItemFormSchema(sourceSchema, item))
      let label = null
      if (isFunction(itemLabel)) {
        let dataPath
        const that = this
        label = itemLabel.call(
          this,
          getItemParams(this, {
            name: undefined,
            value: undefined,
            data: item,

            get dataPath() {
              return dataPath ||
                (dataPath = that.getItemDataPath(sourceSchema, index))
            },

            get formLabel() {
              return getFormLabel()
            }
          })
        )
        // It's up to `itemLabel()` entirely to produce the name:
        extended = false
      } else {
        // Look up the name on the item, by these rules:
        // 1. If `itemLabel` is a string, use it as the property key
        // 2. Otherwise, if there are columns, use the value of the first
        // 3. Otherwise, see if the item has a property named 'name'
        const { columns } = sourceSchema
        const key = (
          isString(itemLabel) && itemLabel ||
          isListSource(sourceSchema) && columns && Object.keys(columns)[0] ||
          'name'
        )
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
