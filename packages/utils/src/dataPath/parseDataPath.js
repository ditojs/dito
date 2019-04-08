import { isArray, isString } from '@/base'

export function parseDataPath(path) {
  if (isArray(path)) {
    return [...path] // Alway return new arrays (clones).
  } else if (isString(path)) {
    const str = path
      // Convert from JavaScript property access notation to JSON pointers:
      .replace(/\.([^.]*)/g, '/$1')
      // Expand array property access notation ([])
      .replace(/\[['"]?([^'"\]]*)['"]?\]/g, '/$1')
    return /^\//.test(str) ? str.substr(1).split('/') : str.split('/')
  }
}
