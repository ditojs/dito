import { isArray } from '../base/index.js'
import { parseDataPath } from './parseDataPath.js'
import { getDeepWildcardEntries } from './getDeepWildcardEntries.js'

export function getValueAtDataPath(
  obj,
  path,
  handleError = () => {
    throw new Error(`Invalid path: ${path}`)
  }
) {
  const parsedPath = parseDataPath(path)
  let index = 0
  for (const part of parsedPath) {
    const isObject = obj && typeof obj === 'object'
    if (isObject && part in obj) {
      obj = obj[part]
      index++
      continue
    } else if (isObject && part === '*') {
      // Support wildcards on arrays and objects
      const pathNested = parsedPath.slice(index + 1)
      const values = isArray(obj) ? obj : Object.values(obj)
      return values
        .map(value => getValueAtDataPath(value, pathNested, handleError))
        .flat(1)
    } else if (part === '**') {
      // Support deep wildcards on arrays and objects:
      const entries = getDeepWildcardEntries(obj, parsedPath.slice(index), [])
      return [...entries.values()]
    }
    return handleError?.(obj, part, index)
  }
  return obj
}
