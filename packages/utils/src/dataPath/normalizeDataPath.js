import { isArray } from '../base/index.js'
import { parseDataPath } from './parseDataPath.js'

export function normalizeDataPath(dataPath) {
  const path = parseDataPath(dataPath)
  // Normalize relative tokens and concatenated absolute paths.
  for (let i = 0; i < path.length; i++) {
    const token = path[i]
    if (token === '.') {
      path.splice(i, 1)
      i--
    } else if (token === '..') {
      if (i === 0) {
        throw new Error(
          `Invalid data path: '${
            isArray(dataPath) ? dataPath.join('/') : dataPath
          }' leads above the root.`
        )
      }
      path.splice(--i, 2)
      i--
    } else if (token === '') {
      if (i === path.length - 1) {
        // Remove trailing slash
        path.splice(i, 1)
      } else {
        // The beginning of a concatenated absolute path:
        // Start from scratch, see `parseDataPath.test.js`
        path.splice(0, i + 1)
        i = -1
      }
    }
  }
  return path.join('/')
}
