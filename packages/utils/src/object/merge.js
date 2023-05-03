import { isArray, isPlainObject } from '../base/index.js'
import { clone } from './clone.js'

export function merge(target, ...sources) {
  const mergeIteratively = (target, source, cloneTarget, concat) => {
    const result = cloneTarget
      ? clone(target, { shallow: true })
      : target
    for (const key of Object.keys(source)) {
      const to = target[key]
      const from = source[key]
      if (
        !concat ||
        isArray(to) && isArray(from) ||
        isPlainObject(to) && isPlainObject(from)
      ) {
        result[key] = mergeValues(to, from, true)
      } else {
        // Append non-mergeable values to the end of results.
        result.push(from)
      }
    }
    return result
  }

  const mergeValues = (target, source, cloneTarget) => {
    if (target && source && target !== source) {
      if (isArray(target) && isArray(source)) {
        return mergeIteratively(target, source, cloneTarget, true)
      } else if (isPlainObject(target) && isPlainObject(source)) {
        return mergeIteratively(target, source, cloneTarget, false)
      }
    }
    return source
  }

  for (const source of sources) {
    target = mergeValues(target, source, false)
  }
  return target
}
