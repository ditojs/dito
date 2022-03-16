import { parseDataPath } from './parseDataPath.js'
import { getValueAtDataPath } from './getValueAtDataPath.js'

export function setValueAtDataPath(obj, path, value) {
  const parts = parseDataPath(path)
  const last = parts.pop()
  const dest = getValueAtDataPath(obj, parts)
  if (!(dest && typeof dest === 'object')) {
    throw new Error(`Invalid path: ${path}`)
  }
  dest[last] = value
  return obj
}
