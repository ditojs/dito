import DitoContext from '../DitoContext.js'
import { getParentItem } from '../utils/data.js'

// @vue/component
export default {
  computed: {
    context() {
      return new DitoContext(this, { nested: this.nested })
    },

    // The following computed properties are similar to `DitoContext`
    // properties, so that we can access these on `this` as well:
    // NOTE: While internally, we speak of `data`, in the API surface the
    // term `item` is used for the data that relates to editing objects.
    // The same as `DitoContext.parentItem`, which never returns the item
    // itself as its parent either.
    parentData() {
      const data = getParentItem(this.rootData, this.dataPath, this.nested)
      return data !== this.data ? data : null
    },

    item() {
      return this.data
    },

    parentItem() {
      return this.parentData
    },

    rootItem() {
      return this.rootData
    }
  }
}
