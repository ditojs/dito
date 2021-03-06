import { isInteger, parseDataPath, getValueAtDataPath } from '@ditojs/utils'

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

export function getLastDataPathToken(dataPath) {
  const path = parseDataPath(dataPath)
  return path[path.length - 1]
}

export function getLastDataPathName(dataPath) {
  const token = getLastDataPathToken(dataPath)
  return token == null || isInteger(+token) ? null : token
}

export function getLastDataPathIndex(dataPath) {
  const token = getLastDataPathToken(dataPath)
  const index = token == null ? null : +token
  return isInteger(index) ? index : null
}

let temporaryId = 0
export function setTemporaryId(data, idKey = 'id') {
  // Temporary ids are marked with a '@' at the beginning.
  data[idKey] = `@${++temporaryId}`
}

export function isTemporaryId(id) {
  return /^@/.test(id)
}

export function hasTemporaryId(data, idKey = 'id') {
  return isTemporaryId(data?.[idKey])
}

export function isReference(data, idKey = 'id') {
  // Returns true if value is an object that holds nothing more than an id.
  return data?.[idKey] != null && Object.keys(data).length === 1
}
