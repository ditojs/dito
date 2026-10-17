import { parseDataPath } from './parseDataPath.js'
import { normalizeDataPath } from './normalizeDataPath.js'

export function resolveDataPath(dataPath, path) {
  return normalizeDataPath(
    path.startsWith('/')
      ? path
      : [...parseDataPath(dataPath), ...parseDataPath(path)]
  )
}
