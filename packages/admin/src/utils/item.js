import { parseDataPath, getDataPath, isPlainObject } from '@ditojs/utils'

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

export function getItemParams(source, overrides) {
  // Overrides are set on the created instance, after instantiation:
  return Object.assign(new ItemParams(source), overrides)
}

// Use WeakMap for ItemParams objects, so we don't pollute the actual ItemParams
// instance with it.
const paramsMap = new WeakMap()

class ItemParams {
  constructor(source) {
    paramsMap.set(
      this,
      // Create a new object that inherits from `source`, so we can override
      // without changing `source`:
      Object.setPrototypeOf({}, source)
    )
    // If `source` is not a plain object, assume it's the target of this event.
    if (!isPlainObject(source)) {
      this.target = source
    }
  }

  get value() {
    return get(this, 'value')
  }

  set value(value) {
    // Allow overriding of `value`, so overrides can provide their own:
    set(this, 'value', value)
  }

  get name() {
    return get(this, 'name')
  }

  get item() {
    // NOTE: While internally, we speak of `data`, in the API surface the
    // term `item` is used for the data that relates to editing objects:
    // If `data` isn't provided, we can determine it from rootData & dataPath:
    return get(this, 'data') || getItem(this.rootItem, this.dataPath, true)
  }

  set item(item) {
    // Allow overriding of `item`, so overrides can provide their own:
    set(this, 'data', item)
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

  get dataPath() {
    return get(this, 'dataPath') || ''
  }

  get formComponent() {
    return get(this, 'formComponent') || null
  }
}

function get(that, key) {
  return paramsMap.get(that)[key]
}

function set(that, key, value) {
  const params = paramsMap.get(that)
  // Temporarily break inheritance chain with original params, so we can
  // override value locally, without triggering setters above.
  const origParams = Object.getPrototypeOf(params)
  Object.setPrototypeOf(params, null)
  params.value = value
  Object.setPrototypeOf(params, origParams)
}
