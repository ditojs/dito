import { isArray, isPlainObject } from '../base/index.js'
import { clone } from './clone.js'

export function merge(target, ...sources) {
  const mergeIteratively = (target, source, root, concat) => {
    const result = root
      ? target
      : clone(target, { shallow: true })
    for (const key of Object.keys(source)) {
      const to = target[key]
      const from = source[key]
      if (
        !concat ||
        isArray(to) && isArray(from) ||
        isPlainObject(to) && isPlainObject(from)
      ) {
        result[key] = mergeValues(to, from, false)
      } else {
        // Append non-mergeable values to the end of results.
        result.push(from)
      }
    }
    return result
  }

  const mergeValues = (target, source, root) => {
    if (target && source && target !== source) {
      if (isArray(target) && isArray(source)) {
        return mergeIteratively(target, source, root, true)
      } else if (isPlainObject(target) && isPlainObject(source)) {
        return mergeIteratively(target, source, root, false)
      }
    }
    return root ? source ?? target : source
  }

  for (const source of sources) {
    target = mergeValues(target, source, true)
  }
  return target
}
