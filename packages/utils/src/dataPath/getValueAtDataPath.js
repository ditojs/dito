import { isArray } from '../base/index.js'
import { parseDataPath } from './parseDataPath.js'

export function getValueAtDataPath(
  obj,
  path,
  handleError = () => { throw new Error(`Invalid path: ${path}`) }
) {
  const parsedPath = parseDataPath(path)
  let index = 0
  for (const part of parsedPath) {
    if (obj && typeof obj === 'object') {
      if (part in obj) {
        obj = obj[part]
        index++
        continue
      } else if (part === '*') {
        // Support wildcards on arrays and objects
        const subPath = parsedPath.slice(index + 1)
        const values = isArray(obj) ? obj : Object.values(obj)
        const results = values.map(
          value => getValueAtDataPath(value, subPath, handleError)
        )
        const flat = subPath.filter(part => part === '*').length
        return flat > 0 ? results.flat(flat) : results
      }
    }
    return handleError?.(obj, part, index)
  }
  return obj
}
