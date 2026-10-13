import { setValueAtDataPath } from './setValueAtDataPath.js'

export function setEntriesAtDataPath(obj, entries) {
  for (const [path, value] of Object.entries(entries)) {
    setValueAtDataPath(obj, path, value)
  }
  return obj
}
