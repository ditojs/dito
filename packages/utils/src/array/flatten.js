import { isArray } from '../base/index.js'

export function flatten(array, maxDepth = Infinity) {
  const res = []
  const add = (array, depth) => {
    for (let i = 0, l = array.length; i < l; i++) {
      const value = array[i]
      if (depth < maxDepth && isArray(value)) {
        add(value, depth + 1)
      } else {
        res.push(value)
      }
    }
  }
  add(array, 0)
  return res
}
