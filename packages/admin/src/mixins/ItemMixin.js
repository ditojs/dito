import DitoContext from '../DitoContext.js'
import {
  getItemFormSchema, getItemId, getItemUid, isListSource
} from '../utils/schema.js'
import { appendDataPath } from '../utils/data.js'
import { isObject, isString, isFunction } from '@ditojs/utils'

// @vue/component
export default {
  methods: {
    getItemFormSchema,

    getItemUid,

    getItemId(sourceSchema, item, index = null) {
      return this.isTransient && index !== null
        ? String(index)
        : getItemId(sourceSchema, item)
    },

    getItemDataPath(sourceSchema, index) {
      let { dataPath } = this
      if (sourceSchema !== this.schema) {
        dataPath = appendDataPath(dataPath, sourceSchema.name)
      }
      if (index != null) {
        dataPath = appendDataPath(dataPath, index)
      }
      return dataPath
    },

    findItemIdIndex(sourceSchema, data, itemId) {
      const index = this.isTransient
        // For transient data, the index is used as the id
        ? itemId
        : data?.findIndex(
          (item, index) =>
            this.getItemId(sourceSchema, item, index) === itemId
        )
      return index !== -1 ? index : null
    },

    getItemLabel(sourceSchema, item, {
      index = null,
      extended = false,
      asObject = false
    } = {}) {
      const { itemLabel } = sourceSchema
      if (!item || !extended && itemLabel === false) {
        return null
      }

      let dataPath
      const getDataPath = () =>
        (dataPath ||= this.getItemDataPath(sourceSchema, index))

      let formLabel
      const getFormLabel = () =>
        (formLabel ||= this.getLabel(
          getItemFormSchema(sourceSchema, item, this.context)
        ))

      let text
      let prefix
      let suffix
      if (isFunction(itemLabel)) {
        const label = itemLabel.call(
          this,
          new DitoContext(this, {
            nested: false,
            data: item,
            value: item,
            index,

            get dataPath() {
              return getDataPath()
            },

            get formLabel() {
              return getFormLabel()
            }
          })
        )
        if (isObject(label)) {
          ({ text, prefix, suffix } = label)
        } else {
          text = label
        }
        // It's up to `itemLabel()` entirely to produce the label:
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
        text = item[key]
      }
      const hadLabel = !!text
      text = text || ''
      // If no label was found so far, try to produce one from theindex.
      if (!text) {
        // Always use extended style when auto-generating labels from index/id:
        extended = true
        if (isListSource(sourceSchema) && index !== null) {
          text = `${index + 1}`
        }
      }
      if (extended) {
        const formLabel = getFormLabel()
        if (formLabel) {
          // If a label was provided, put in quotes when prefixed with the
          // form label for the extended style:
          text = `${formLabel} ${hadLabel ? `'${text}'` : text}`
        }
      }
      return asObject ? { text, prefix, suffix } : text
    }
  }
}
