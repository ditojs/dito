import { parseDataPath } from './parseDataPath'
import { getDataPath } from './getDataPath'

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
