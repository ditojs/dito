import { isArray, asArray } from '../base/index.js'
import { parseDataPath } from './parseDataPath.js'

const NOT_FOUND = Symbol('NOT_FOUND')

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
    if (obj && typeof obj === 'object') {
      if (part in obj) {
        obj = obj[part]
        index++
        continue
      } else if (part === '*') {
        // Support wildcards on arrays and objects
        const pathNested = parsedPath.slice(index + 1)
        const values = isArray(obj) ? obj : Object.values(obj)
        return values
          .map(value => getValueAtDataPath(value, pathNested, handleError))
          .flat(1)
      } else if (part === '**') {
        // Support deep wildcards on arrays and objects
        const pathNested = parsedPath.slice(index + 1)
        const pathSelf = parsedPath.slice(index)
        const values = isArray(obj) ? obj : Object.values(obj)
        return values
          .map(value => [
            ...asArray(getValueAtDataPath(value, pathNested, () => NOT_FOUND)),
            ...asArray(getValueAtDataPath(value, pathSelf, () => NOT_FOUND))
          ])
          .flat(1)
          .filter(value => value !== NOT_FOUND)
      }
    }
    return handleError?.(obj, part, index)
  }
  return obj
}
