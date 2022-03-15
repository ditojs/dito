import { isArray, isPlainObject } from '../base'
import { clone } from './clone'

export function merge(target, ...sources) {
  const _merge = (target, source, cloneTarget) => {
    if (target && source && (
      isArray(target) && isArray(source) ||
      isPlainObject(target) && isPlainObject(source)
    )) {
      const result = cloneTarget
        ? clone(target)
        : target
      for (const key of Object.keys(source)) {
        const value = _merge(target[key], source[key], true)
        if (value !== undefined || !(key in result)) {
          result[key] = value
        }
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
