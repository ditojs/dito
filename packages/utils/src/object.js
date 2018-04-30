import { isArray, isObject } from './base'

export function pick(...args) {
  // Optimize for the most common case of two arguments:
  if (args.length === 2) {
    return args[0] !== undefined ? args[0] : args[1]
  }
  for (const arg of args) {
    if (arg !== undefined) {
      return arg
    }
  }
}

export function clone(obj) {
  return obj != null ? JSON.parse(JSON.stringify(obj)) : obj
}

export function equals(obj1, obj2) {
  if (obj1 === obj2) {
    return true
  }
  if (obj1 && obj2) {
    if (isArray(obj1) && isArray(obj2)) {
      let { length } = obj1
      if (length === obj2.length) {
        while (length--) {
          if (!equals(obj1[length], obj2[length])) {
            return false
          }
        }
        return true
      }
    } else if (isObject(obj1) && isObject(obj2)) {
      const keys = Object.keys(obj1)
      if (keys.length === Object.keys(obj2).length) {
        for (const key of keys) {
          if (!(obj2.hasOwnProperty(key) && equals(obj1[key], obj2[key]))) {
            return false
          }
        }
        return true
      }
    }
  }
  return false
}

export function deepMerge(target, ...sources) {
  if (target && sources.length) {
    for (const source of sources) {
      if (isArray(source)) {
        for (const value of source) {
          target.push(value)
        }
      } else if (isObject(source)) {
        for (const key in source) {
          let value = source[key]
          if (isArray(value)) {
            value = deepMerge(target[key] || [], value)
          } else if (isObject(value)) {
            value = deepMerge(target[key] || {}, value)
          }
          target[key] = value
        }
      }
    }
  }
  return target
}
