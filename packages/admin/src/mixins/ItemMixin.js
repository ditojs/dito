import DitoContext from '../DitoContext.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { getItemUid } from '../utils/schema/data.js'
import {
  getItemIdOrIndex,
  findItemIndexById,
  getItemLabel
} from '../utils/schema/item.js'
import { appendDataPath } from '../utils/data.js'

// Delegates to the item functions in `utils/schema/item.js`, with the data
// path, context and `isTransient` state of the component that mixes it in.
// @vue/component
export default {
  methods: {
    getItemFormSchema,

    getItemUid,

    getItemId(sourceSchema, item, index = null) {
      return getItemIdOrIndex(sourceSchema, item, {
        index,
        isTransient: this.isTransient
      })
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
      return findItemIndexById(sourceSchema, data, itemId, {
        isTransient: this.isTransient
      })
    },

    // Returns the label of `item` as HTML, see `getItemLabel()`.
    getItemLabel(sourceSchema, item, {
      index = null,
      extended = false,
      asObject = false
    } = {}) {
      let dataPath
      const getDataPath = () =>
        (dataPath ??= this.getItemDataPath(sourceSchema, index))

      let formLabel
      const getFormLabel = () =>
        (formLabel ??= this.getLabel(
          getItemFormSchema(sourceSchema, item, this.context)
        ))

      return getItemLabel(sourceSchema, item, {
        index,
        extended,
        asObject,
        getFormLabel,
        evaluateItemLabel: () =>
          sourceSchema.itemLabel.call(
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
      })
    }
  }
}
