import { normalizeDataPath } from './normalizeDataPath.js'

// Collect the values that `path` reaches inside `obj` depth-first by their data
// paths, starting with `prefix`, and skip the ones not found. Deep wildcards
// can reach the same value in several ways, e.g. in `**/a/**/b`, and work like
// in `.gitignore`: In the middle of the path, they match zero levels with the
// rest of the path, or more levels with the wildcard again. At its end, they
// match all values inside, but not the value itself:
export function getDeepWildcardEntries(obj, path, prefix, entries = new Map()) {
  const [part, ...pathNested] = path
  const isObject = obj && typeof obj === 'object'
  const keys = isObject ? Object.keys(obj) : []
  const collect = (key, path) =>
    getDeepWildcardEntries(obj[key], path, [...prefix, key], entries)
  if (path.length === 0) {
    entries.set(normalizeDataPath(prefix), obj)
  } else if (part === '**') {
    if (pathNested.length > 0) {
      getDeepWildcardEntries(obj, pathNested, prefix, entries)
    }
    for (const key of keys) {
      if (pathNested.length === 0) {
        collect(key, [])
      }
      collect(key, path)
    }
  } else if (part === '*') {
    for (const key of keys) {
      collect(key, pathNested)
    }
  } else if (isObject && part in obj) {
    collect(part, pathNested)
  }
  return entries
}
