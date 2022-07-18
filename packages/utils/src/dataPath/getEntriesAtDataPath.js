import { parseDataPath } from './parseDataPath.js'
import { normalizeDataPath } from './normalizeDataPath.js'

export function getEntriesAtDataPath(
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
        const pathStart = normalizeDataPath(parsedPath.slice(0, index))
        const pathEnd = parsedPath.slice(index + 1)
        return Object.entries(obj).reduce(
          (map, [key, value]) => {
            const entries = getEntriesAtDataPath(value, pathEnd, handleError)
            const pathToKey = pathStart ? `${pathStart}/${key}` : key
            for (const [subPath, subVal] of Object.entries(entries)) {
              map[`${pathToKey}/${subPath}`] = subVal
            }
            return map
          },
          {}
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
