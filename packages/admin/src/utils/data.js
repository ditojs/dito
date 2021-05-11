import {
  isString, isInteger, isArray, isPlainObject,
  parseDataPath, getValueAtDataPath
} from '@ditojs/utils'

export function appendDataPath(dataPath, token) {
  return dataPath
    ? `${dataPath}/${token}`
    : token
}

export function getItem(rootItem, dataPath, isValue = false) {
  const path = parseDataPath(dataPath)
  // Remove the first path token if the path is not to an item's value, and see
  // if it's valid:
  return path && (!isValue || path.pop() != null)
    ? getValueAtDataPath(rootItem, path)
    : null
}

export function getParentItem(rootItem, dataPath, isValue = false) {
  const path = parseDataPath(dataPath)
  if (path) {
    // Remove the first path token if the path is not to an item's value:
    if (isValue) path.pop()
    // Remove the parent token. If it's a number, then we're dealing with an
    // array and need to remove more tokens until we meet the actual parent:
    let token
    do {
      token = path.pop()
    } while (token != null && isInteger(+token))
    // If the removed token is valid, we can get the parent data:
    if (token != null) {
      return getValueAtDataPath(rootItem, path)
    }
  }
  return null
}

export function getParentToken(dataPath) {
  const path = parseDataPath(dataPath)
  return path[path.length - 1]
}

export function getParentKey(dataPath) {
  const token = getParentToken(dataPath)
  return isString(token) ? token : null
}

export function getParentIndex(dataPath) {
  const index = +getParentToken(dataPath)
  return isInteger(index) ? index : null
}

let temporaryId = 0
export function setTemporaryId(data, idName = 'id') {
  // Temporary ids are marked with a '@' at the beginning.
  data[idName] = `@${++temporaryId}`
}

export function hasTemporaryId(data) {
  return /^@/.test(data?.id)
}

export function isReference(data) {
  // Returns true if value is an object that holds nothing more than an id.
  return data?.id != null && Object.keys(data).length === 1
}

export function processReference(value, options) {
  // @ditojs/server specific handling of relates within graphs:
  // Find entries with temporary ids, and convert them to #id / #ref pairs.
  // Also handle items with relate and convert them to only contain ids.
  if (
    options.processIds &&
    hasTemporaryId(value)
  ) {
    const { id, ...rest } = value
    // A reference is a shallow copy that hold nothing more than ids.
    // Use #ref instead of #id for these:
    return isReference(value)
      ? { '#ref': id }
      : { '#id': id, ...rest }
  } else if (
    options.removeIds &&
    value?.id != null &&
    !isReference(value)
  ) {
    // Only remove ids if it isn't a reference.
    // TODO: This doesn't work with references withhin the graph, since we
    // remove the target's id at the same time, and we have no way of knowing
    // that it is actually the target of the reference. Not sure how to handle
    // this in a way that can preserve internal and external references, since
    // such internal references would need to be converted to #ref / #id, while
    // external can keep using the id. The only way to fix this is to add an
    // additional field to options components that tells them if their data is
    // from inside the graph (e.g. `internal: true`) or outside.
    const { id, ...rest } = value
    return rest
  }
  return value
}

export function processReferences(value, options) {
  return isPlainObject(value)
    ? processReference(value, options)
    : isArray(value)
      ? value.map(entry => processReference(entry, options))
      : value
}

export function shallowClone(value) {
  return isPlainObject(value)
    ? { ...value }
    : isArray(value)
      ? [...value]
      : value
}
