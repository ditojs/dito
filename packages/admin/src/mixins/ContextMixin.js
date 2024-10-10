import DitoContext from '../DitoContext.js'
import { getItem, getParentItem } from '../utils/data.js'

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
    // NOTE: This should always return the same as:
    // return getItem(this.rootData, this.dataPath, false)
    parentData() {
      const data = getParentItem(this.rootData, this.dataPath, this.nested)
      return data !== this.data ? data : null
    },

    // @overridable
    processedData() {
      return getProcessedParentData(this, this.dataPath, this.nested)
    },

    processedRootData() {
      return getProcessedParentData(this, '', false)
    },

    item() {
      return this.data
    },

    parentItem() {
      return this.parentData
    },

    rootItem() {
      return this.rootData
    },

    processedItem() {
      return this.processedData
    },

    processedRootItem() {
      return this.processedRootData
    }
  }
}

function getProcessedParentData(component, dataPath, nested = false) {
  // We can only get the processed data through the schemaComponent, but
  // that's not necessarily the item represented by this component.
  // Solution: Find the relative path and the processed sub-item from there:
  let { schemaComponent } = component
  // Find the schema component that contains the desired data-path:
  while (schemaComponent.dataPath.length > dataPath.length) {
    schemaComponent = schemaComponent.parentSchemaComponent
  }
  return getItem(
    schemaComponent.processedData,
    // Get the dataPath relative to the schemaComponent's data:
    dataPath.slice(schemaComponent.dataPath.length),
    nested
  )
}
