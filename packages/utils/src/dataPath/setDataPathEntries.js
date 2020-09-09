import { setValueAtDataPath } from './setValueAtDataPath'

export function setDataPathEntries(obj, entries) {
  for (const [path, value] of Object.entries(entries)) {
    setValueAtDataPath(obj, path, value)
  }
  return obj
}
