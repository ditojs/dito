import { parseDataPath } from './parseDataPath'

export function normalizeDataPath(path) {
  return parseDataPath(path).join('/')
}
