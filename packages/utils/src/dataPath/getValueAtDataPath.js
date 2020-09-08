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
    if (obj && typeof obj === 'object' && part in obj) {
      obj = obj[part]
      index++
      continue
    }
    return handleError?.(obj, part, index)
  }
  return obj
}
