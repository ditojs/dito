import { parseDataPath, getDataPath, isFunction } from '@ditojs/utils'

export function appendDataPath(dataPath, token) {
  return dataPath != null && dataPath !== ''
    ? `${dataPath}/${token}`
    : token
}

export function getItem(rootItem, dataPath, isValue) {
  const path = parseDataPath(dataPath)
  // Remove the first path token if the path is not to an item's value, and see
  // if it's valid:
  return path && (!isValue || path.pop() != null)
    ? getDataPath(rootItem, path)
    : null
}

export function getParentItem(rootItem, dataPath, isValue) {
  const path = parseDataPath(dataPath)
  if (path) {
    // Remove the first path token if the path is not to an item's value:
    if (isValue) path.pop()
    // Remove the parent token. If it's a number, then we're dealing with an
    // array and need to remove more tokens until we meet the actual parent:
    let token
    do {
      token = path.pop()
    } while (token != null && !isNaN(token))
    // If the removed token is valid, we can get the parent data:
    if (token != null) {
      return getDataPath(rootItem, path)
    }
  }
  return null
}

export function getItemParams(target, params) {
  return new ItemParams(target, params)
}

// Use WeakMap for ItemParams objects, so we don't have to pollute the actual
// ItemParams instance with it.
const paramsMap = new WeakMap()

function get(that, key) {
  return paramsMap.get(that)[key]
}

class ItemParams {
  constructor(target, params) {
    // Use the provided params object / function, or create a new one:
    params = params
      ? (isFunction(params) ? params() : params)
      : {}
    params.target = target
    // Have `params` inherit from `target`, so it can override its values and
    // still retrieve from it, and associate it with `this` through `paramsMap`:
    paramsMap.set(this, Object.setPrototypeOf(params, target))
  }

  get value() {
    return get(this, 'value')
  }

  get name() {
    return get(this, 'name')
  }

  get dataPath() {
    return get(this, 'dataPath') || ''
  }

  get item() {
    // NOTE: While internally, we speak of `data`, in the API surface the
    // term `item` is used for the data that relates to editing objects:
    // If `data` isn't provided, we can determine it from rootData & dataPath:
    return get(this, 'data') || getItem(this.rootItem, this.dataPath, true)
  }

  // NOTE: `parentItem` isn't the closest data parent to `item`, it's the
  // closest parent that isn't an array, e.g. for relations or nested JSON
  // data.  This is why the term `item` was chosen over `data`, e.g. VS the
  // use of `parentData` in server-sided validation, which is the closest
  // parent. If needed, we could expose this data here too, as we can do all
  // sorts of data processing with `rootData` and `dataPath`.
  get parentItem() {
    return getParentItem(this.rootItem, this.dataPath, true) || null
  }

  get rootItem() {
    return get(this, 'rootData') || null
  }

  get target() {
    return get(this, 'target') || null
  }

  get user() {
    return get(this, 'user') || null
  }

  get api() {
    return get(this, 'api') || null
  }

  get itemLabel() {
    return get(this, 'itemLabel') || null
  }

  get formLabel() {
    return get(this, 'formLabel') || null
  }

  get schemaComponent() {
    return get(this, 'schemaComponent') || null
  }

  get formComponent() {
    return get(this, 'formComponent') || null
  }

  get viewComponent() {
    return get(this, 'viewComponent') || null
  }

  get dialogComponent() {
    return get(this, 'dialogComponent') || null
  }

  get panelComponent() {
    return get(this, 'panelComponent') || null
  }

  get request() {
    return get(this, 'request') || null
  }

  get response() {
    return get(this, 'response') || null
  }

  get error() {
    return get(this, 'error') || null
  }
}
