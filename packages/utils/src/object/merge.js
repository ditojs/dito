import { isArray, isPlainObject } from '../base/index.js'
import { clone } from './clone.js'

export function merge(target, ...sources) {
  const _merge = (target, source, cloneTarget) => {
    if (target && source && target !== source && (
      isArray(target) && isArray(source) ||
      isPlainObject(target) && isPlainObject(source)
    )) {
      const result = cloneTarget
        ? clone(target)
        : target
      for (const key of Object.keys(source)) {
        result[key] = _merge(target[key], source[key], true)
      }
      return result
    }
    return source
  }

  for (const source of sources) {
    _merge(target, source, false)
  }
  return target
}
