import { parseDataPath } from './parseDataPath.js'
import { normalizeDataPath } from './normalizeDataPath.js'

const NOT_FOUND = Symbol('NOT_FOUND')

export function getEntriesAtDataPath(
  obj,
  path,
  handleError = () => {
    throw new Error(`Invalid path: ${path}`)
  }
) {
  const parsedPath = parseDataPath(path)

  const prefixEntries = (obj, index, getEntries) => {
    const prefix = normalizeDataPath(parsedPath.slice(0, index))
    return Object.entries(obj).reduce(
      (map, [key, value]) => {
        const pathKey = prefix ? `${prefix}/${key}` : key
        for (const [path, val] of Object.entries(getEntries(value))) {
          if (val !== NOT_FOUND) {
            map[`${pathKey}/${path}`] = val
          }
        }
        return map
      },
      {}
    )
  }

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
        return prefixEntries(
          obj,
          index,
          value => getEntriesAtDataPath(value, pathNested, handleError)
        )
      } else if (part === '**') {
        // Support wildcards on arrays and objects
        const pathNested = parsedPath.slice(index + 1)
        const pathSelf = parsedPath.slice(index)
        return prefixEntries(
          obj,
          index,
          value => ({
            ...getEntriesAtDataPath(value, pathNested, () => NOT_FOUND),
            ...getEntriesAtDataPath(value, pathSelf, () => NOT_FOUND)
          })
        )
      }
    }
    const res = handleError?.(obj, part, index)
    // Do not add `undefined` results to the resulting entries object.
    return res !== undefined
      ? { [normalizeDataPath(parsedPath)]: res }
      : {}
  }
  return { [normalizeDataPath(parsedPath)]: obj }
}
