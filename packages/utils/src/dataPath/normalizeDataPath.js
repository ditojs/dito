import { parseDataPath } from './parseDataPath.js'

export function normalizeDataPath(path) {
  path = parseDataPath(path)
  // Normalize relative tokens and concatenated absolute paths.
  for (let i = 0; i < path.length; i++) {
    const token = path[i]
    if (token === '.' || token === '..' && i === 0) {
      path.splice(i, 1)
      i--
    } else if (token === '..') {
      path.splice(--i, 2)
      i--
    } else if (token === '') {
      // The beginning of a concatenated absolute path:
      // Start from scratch, see `parseDataPath.test.js`
      path.splice(0, i + 1)
      i = 0
    }
  }
  return path.join('/')
}
