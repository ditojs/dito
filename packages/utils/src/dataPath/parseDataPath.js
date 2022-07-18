import { isArray, isString } from '../base/index.js'

export function parseDataPath(path) {
  if (isArray(path)) {
    return [...path] // Alway return new arrays (clones).
  } else if (isString(path)) {
    if (!path) return []
    const str = path
      // Convert from JavaScript property access notation to JSON pointers,
      // while preserving '..' in paths:
      .replace(/\.([^./]+)/g, '/$1')
      // Expand array property access notation ([])
      .replace(/\[['"]?([^'"\]]*)['"]?\]/g, '/$1')
    return /^\//.test(str) ? str.slice(1).split('/') : str.split('/')
  }
}
