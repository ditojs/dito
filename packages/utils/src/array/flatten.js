import { isArray } from '../base/index.js'

export function flatten(array, maxDepth = Infinity, _depth = 0) {
  const res = []
  for (let i = 0, l = array.length; i < l; i++) {
    const value = array[i]
    if (_depth < maxDepth && isArray(value)) {
      res.push(...flatten(value, maxDepth, _depth + 1))
    } else {
      res.push(value)
    }
  }
  return res
}
