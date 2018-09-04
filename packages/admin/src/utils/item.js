import { parseDataPath, getDataPath } from '@ditojs/utils'

export function getItem(rootData, dataPath) {
  const path = parseDataPath(dataPath)
  // Remove the path token for the value, and see if it's valid:
  return path && path.pop() != null
    ? getDataPath(rootData, path)
    : null
}

export function getParentItem(rootData, dataPath) {
  const path = parseDataPath(dataPath)
  // Remove the path token for the value, and see if it's valid:
  if (path && path.pop() != null) {
    // Remove the parent token. If it's a number, then we're dealing with an
    // array and need to remove more tokens until we meet the parent:
    let token
    do {
      token = path.pop()
    } while (!isNaN(token))
    // If the removed token is valid, we can get the parent data:
    if (token != null) {
      return getDataPath(rootData, path)
    }
  }
  return null
}

export function getItemParams(params, overrides) {
  return Object.assign({
    get value() {
      return params.value
    },

    set value(value) {
      // Allow overriding of `value`, so overrides can provide their own:
      delete this.value
      this.value = value
    },

    get name() {
      return params.name
    },

    // NOTE: While internally, we speak of `data`, in the API surface, the term
    // `item` is used for the data that relates to editing objects:
    get item() {
      // If `data` isn't provided, we can determine it from rootData & dataPath:
      return params.data || getItem(params.rootData, params.dataPath)
    },

    set item(item) {
      // Allow overriding of `item`, so overrides can provide their own:
      delete this.item
      this.item = item
    },

    // NOTE: `parentItem` isn't the closest data parent to `item`, it's the
    // closest parent that isn't an array, e.g. for relations or nested JSON
    // data.  This is why the term `item` was chosen over `data`, e.g. VS the
    // use of `parentData` in server-sided validation, which is the closest
    // parent. If needed, we could expose this data here too, as we can do all
    // sorts of data processing with `rootData` and `dataPath`.
    get parentItem() {
      return getParentItem(params.rootData, params.dataPath)
    },

    get rootItem() {
      return params.rootData
    },

    get dataPath() {
      return params.dataPath
    }
  }, overrides)
}
