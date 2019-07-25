import { getItemFormSchema, isListSource } from '@/utils/schema'
import { appendDataPath, getItemParams } from '@/utils/data'
import { getUid } from '@/utils/uid'
import { isObject, isString, isFunction } from '@ditojs/utils'

// @vue/component
export default {
  methods: {
    getItemFormSchema,

    getItemId(sourceSchema, item, uid) {
      const id = this.isTransient
        ? (uid !== null ? uid : getUid(item))
        : item[sourceSchema.idName || 'id']
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
      const getDataPath = () => (
        dataPath ||
        (dataPath = this.getItemDataPath(sourceSchema, index))
      )
      let formLabel
      const getFormLabel = () => (
        formLabel ||
        (formLabel = this.getLabel(getItemFormSchema(sourceSchema, item)))
      )
      let text
      let prefix
      let suffix
      if (isFunction(itemLabel)) {
        const label = itemLabel.call(
          this,
          getItemParams(this, {
            name: undefined,
            value: undefined,
            data: item,

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
      // If no label was found so far, try to produce one from the id or index.
      if (text == null) {
        const id = this.getItemId(sourceSchema, item)
        text = id ? `(id: ${id})`
          : isListSource(sourceSchema) && index !== null ? `${index + 1}`
          : ''
        // Always use extended style when auto-generating labels from index/id:
        extended = true
      }
      if (extended) {
        const formLabel = getFormLabel()
        if (formLabel) {
          // If a label was provided, put in quotes when prefixed with the
          // form label for the extended style:
          text = `${formLabel} ${hadLabel ? `'${text}'` : text}`
        }
      }
      text = text || ''
      return asObject ? { text, prefix, suffix } : text
    }
  }
}
