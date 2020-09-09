import { isArray } from '@/base'
import { parseDataPath } from './parseDataPath'
import { normalizeDataPath } from './normalizeDataPath'

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
      } else if (part === '*' && isArray(obj)) {
        // Support wildcards on arrays
        const pathStart = normalizeDataPath(parsedPath.slice(0, index))
        const pathEnd = parsedPath.slice(index + 1)
        return obj.reduce(
          (map, value, key) => {
            const entries = getEntriesAtDataPath(value, pathEnd, handleError)
            for (const [subPath, subVal] of Object.entries(entries)) {
              map[`${pathStart}/${key}/${subPath}`] = subVal
            }
            return map
          },
          {}
        )
      }
    }
    return handleError?.(obj, part, index)
  }
  return {
    [normalizeDataPath(parsedPath)]: obj
  }
}
