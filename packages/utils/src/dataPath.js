import { isArray, isString } from './base'

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

export function normalizeDataPath(path) {
  return parseDataPath(path).join('/')
}

export function getDataPath(obj, path) {
  const parsedPath = parseDataPath(path)
  let next = 0
  for (const part of parsedPath) {
    next++
    if (obj && typeof obj === 'object') {
      if (part in obj) {
        obj = obj[part]
        continue
      } else if (part === '*' && isArray(obj)) {
        // Support wildcards on arrays
        const subPath = parsedPath.slice(next)
        return obj.map(value => getDataPath(value, subPath))
      }
    }
    throw new Error(`Invalid path: ${path}`)
  }
  return obj
}

export function setDataPath(obj, path, value) {
  const parts = parseDataPath(path)
  const last = parts.pop()
  const dest = getDataPath(obj, parts)
  if (!(dest && typeof dest === 'object')) {
    throw new Error(`Invalid path: ${path}`)
  }
  dest[last] = value
  return obj
}
