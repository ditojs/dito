import { parseDataPath } from './parseDataPath'

export function normalizeDataPath(path) {
  path = parseDataPath(path)
  // Normalize relative tokens.
  for (let i = 1; i < path.length; i++) {
    if (path[i] === '..') {
      path.splice(--i, 2)
      i--
    }
  }
  return path.join('/')
}
