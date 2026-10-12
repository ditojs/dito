import {
  isInteger,
  parseDataPath,
  getValueAtDataPath,
  normalizeDataPath
} from '@ditojs/utils'

export function appendDataPath(dataPath, token) {
  return dataPath ? `${dataPath}/${token}` : token
}

// Return `null` if `dataPath` isn't inside `parentDataPath`:
export function getRelativeDataPath(dataPath, parentDataPath) {
  if (dataPath == null || parentDataPath == null) {
    return null
  }
  const path = normalizeDataPath(dataPath)
  const parentPath = normalizeDataPath(parentDataPath)
  return path === parentPath
    ? ''
    : !parentPath
      ? path
      : path.startsWith(`${parentPath}/`)
        ? path.slice(parentPath.length + 1)
        : null
}

function parseParentDataPath(dataPath) {
  const path = parseDataPath(dataPath)
  path?.pop()
  return path
}

export function getParentDataPath(dataPath) {
  return normalizeDataPath(parseParentDataPath(dataPath))
}

function parseItemDataPath(dataPath, nested = false) {
  return nested ? parseParentDataPath(dataPath) : parseDataPath(dataPath)
}

export function getItemDataPath(dataPath, nested = false) {
  return normalizeDataPath(parseItemDataPath(dataPath, nested))
}

function parseParentItemDataPath(dataPath, nested = false) {
  const path = parseItemDataPath(dataPath, nested)
  if (path) {
    // Remove tokens until the parent, skipping the indices of arrays:
    let token
    do {
      token = path.pop()
    } while (token != null && isInteger(+token))
    if (token != null) {
      return path
    }
  }
  return null
}

// Returns `null` for items without a parent item, e.g. the root item.
export function getParentItemDataPath(dataPath, nested = false) {
  const path = parseParentItemDataPath(dataPath, nested)
  return path ? normalizeDataPath(path) : null
}

// Returns `null` if there's no item at the data path, e.g. for removed items.
export function getItem(rootItem, dataPath, nested = false) {
  const path = parseItemDataPath(dataPath, nested)
  return path ? getValueAtDataPath(rootItem, path, () => null) : null
}

export function getParentItem(rootItem, dataPath, nested = false) {
  const path = parseParentItemDataPath(dataPath, nested)
  return path ? getValueAtDataPath(rootItem, path, () => null) : null
}

function getLastDataPathToken(dataPath) {
  // `dataPath` is `null` for items without a parent:
  return parseDataPath(dataPath)?.at(-1)
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
export function createTemporaryId() {
  return `@${++temporaryId}`
}

export function isTemporaryId(id) {
  return /^@/.test(id)
}

export function isReference(data, idKey = 'id') {
  return data?.[idKey] != null && Object.keys(data).length === 1
}
