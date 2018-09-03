import { parseDataPath, getDataPath } from '@ditojs/utils'

export function getItemData(rootData, dataPath) {
  const path = parseDataPath(dataPath)
  // Remove own path, and see if it's valid:
  return path && path.pop() != null
    ? getDataPath(rootData, path)
    : null
}

export function getParentData(rootData, dataPath) {
  const path = parseDataPath(dataPath)
  // Remove own path, and see if it's valid:
  if (path && path.pop() != null) {
    // Remove parent path. If it's a number, then we're dealing with an
    // array and need to remove another layer:
    let key = path.pop()
    if (!isNaN(key)) {
      key = path.pop()
    }
    // If the removed path is valid, we can get the parent data:
    if (key != null) {
      return getDataPath(rootData, path)
    }
  }
  return null
}

export function getDataParams(params, overrides) {
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

    get data() {
      // If data isn't provided, we can determine it from rootData & dataPath:
      return params.data || getItemData(params.rootData, params.dataPath)
    },

    set data(data) {
      // Allow overriding of `data`, so overrides can provide their own:
      delete this.data
      this.data = data
    },

    get rootData() {
      return params.rootData
    },

    get dataPath() {
      return params.dataPath
    },

    get parentData() {
      return getParentData(params.rootData, params.dataPath)
    }
  }, overrides)
}
