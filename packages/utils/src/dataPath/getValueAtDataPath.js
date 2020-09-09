import { isArray } from '@/base'
import { parseDataPath } from './parseDataPath'

// TODO: Implement `getEntriesAtDataPath()` -> { [dataPath]: value }
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
      } else if (part === '*' && isArray(obj)) {
        // Support wildcards on arrays
        const subPath = parsedPath.slice(index + 1)
        return obj.map(value => getValueAtDataPath(value, subPath, handleError))
      }
    }
    return handleError?.(obj, part, index)
  }
  return obj
}
