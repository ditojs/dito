import { parseDataPath } from './parseDataPath.js'
import { normalizeDataPath } from './normalizeDataPath.js'
import { getDeepWildcardEntries } from './getDeepWildcardEntries.js'

export function getEntriesAtDataPath(
  obj,
  path,
  handleError = () => {
    throw new Error(`Invalid path: ${path}`)
  }
) {
  const parsedPath = parseDataPath(path)

  // Prefix the entries found beneath `path`:
  const prefixEntries = (path, entries) =>
    Object.fromEntries(
      Object.entries(entries).map(([key, value]) => [
        normalizeDataPath([...path, key]),
        value
      ])
    )

  let index = 0
  for (const part of parsedPath) {
    const isObject = obj && typeof obj === 'object'
    if (isObject && part in obj) {
      obj = obj[part]
      index++
      continue
    } else if (isObject && part === '*') {
      // Support wildcards on arrays and objects
      const prefix = parsedPath.slice(0, index)
      const pathNested = parsedPath.slice(index + 1)
      return Object.assign(
        {},
        ...Object.entries(obj).map(([key, value]) =>
          prefixEntries(
            [...prefix, key],
            getEntriesAtDataPath(value, pathNested, handleError)
          )
        )
      )
    } else if (part === '**') {
      // Support deep wildcards on arrays and objects:
      return Object.fromEntries(
        getDeepWildcardEntries(
          obj,
          parsedPath.slice(index),
          parsedPath.slice(0, index)
        )
      )
    }
    const res = handleError?.(obj, part, index)
    // Do not add `undefined` results to the resulting entries object.
    return res !== undefined
      ? { [normalizeDataPath(parsedPath)]: res }
      : {}
  }
  return { [normalizeDataPath(parsedPath)]: obj }
}
