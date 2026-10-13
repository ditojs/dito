import { parseDataPath } from './parseDataPath.js'

export function resolveDataPath(dataPath, path) {
  const tokens = path.startsWith('/')
    ? parseDataPath(path)
    : [...parseDataPath(dataPath), ...parseDataPath(path)]
  const resolved = []
  for (const token of tokens) {
    if (token === '..') {
      if (resolved.length === 0) {
        throw new Error(
          `Invalid data path: '${path}' leads above the root from '${
            dataPath
          }'.`
        )
      }
      resolved.pop()
    } else if (token !== '.' && token !== '') {
      resolved.push(token)
    }
  }
  return resolved.join('/')
}
