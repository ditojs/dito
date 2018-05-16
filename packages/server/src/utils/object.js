import { asArray } from '@ditojs/utils'

export function getAllKeys(object) {
  // Unlike `Object.keys()`, this returns all enumerable keys not just own ones.
  const keys = []
  for (const key in object) {
    keys.push(key)
  }
  return keys
}

export function getOwnProperty(object, key) {
  return object.hasOwnProperty(key) ? object[key] : undefined
}

export function createLookup(keys, filter) {
  return asArray(keys).reduce((obj, key) => {
    if (!filter || filter(key)) {
      obj[key] = true
    }
    return obj
  }, Object.create(null))
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
  if (baseValue && !(key in object)) {
    // If there wasn't any override in the chain, and we have a baseValue,
    // set up direct inheritance from that now.
    object[key] = Object.setPrototypeOf({}, baseValue)
  }
  return object[key]
}
