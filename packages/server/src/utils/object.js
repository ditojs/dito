import { isArray } from '@ditojs/utils'

export function asArguments(val) {
  return isArray(val) ? val : val != null ? [val] : []
}

export function mapValues(obj, callback) {
  return Object.entries(obj).reduce((res, [key, value]) => {
    res[key] = callback(value, key)
    return res
  }, {})
}

export function mergeWithoutOverride(target, ...sources) {
  for (const source of sources) {
    for (const key in source) {
      if (!(key in target)) {
        target[key] = source[key]
      }
    }
  }
  return target
}

export function mergeAsArrays(target, ...sources) {
  for (const source of sources) {
    for (const key in source) {
      const value = source[key]
      if (key in target) {
        target[key].push(value)
      } else {
        target[key] = [value]
      }
    }
  }
  return target
}

export function setupPropertyInheritance(object, key, baseValue = null) {
  // Loops up the inheritance chain of object until the base object is met,
  // and sets up a related inheritance chain for the given property `key`.
  // At the end, the resulting value with proper inheritance is returned.
  let current = object
  while (current !== Object.prototype) {
    const parent = Object.getPrototypeOf(current)
    if (current.hasOwnProperty(key)) {
      const value = current[key]
      const parentValue = parent[key] || baseValue
      if (parentValue) {
        Object.setPrototypeOf(value, parentValue)
      }
    }
    current = parent
  }
  return object[key]
}
