import { isArray } from '@/base'
import { parseDataPath } from './parseDataPath'

export function getDataPath(
  obj,
  path,
  handleError = () => { throw new Error(`Invalid path: ${path}`) }
) {
  const parsedPath = parseDataPath(path)
  let next = 0
  for (const part of parsedPath) {
    const index = next
    next++
    if (obj && typeof obj === 'object') {
      if (part in obj) {
        obj = obj[part]
        continue
      } else if (part === '*' && isArray(obj)) {
        // Support wildcards on arrays
        const subPath = parsedPath.slice(next)
        return obj.map(value => getDataPath(value, subPath, handleError))
      }
    }
    return handleError?.(obj, part, index)
  }
  return obj
}
