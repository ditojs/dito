import { asArray } from '@ditojs/utils'

export const getOwnKeys = Object.keys

export function getAllKeys(object) {
  // Unlike `getOwnKeys()`, this returns all enumerable keys not just own ones.
  const keys = []
  for (const key in object) {
    keys.push(key)
  }
  return keys
}

export function getOwnProperty(object, key) {
  return object.hasOwnProperty(key) ? object[key] : undefined
}

export function createLookup(keys) {
  return asArray(keys).reduce((obj, key) => {
    obj[key] = true
    return obj
  }, Object.create(null))
}

export function mergeReversed(objects) {
  return Object.assign({}, ...[...objects].reverse())
}

export function mergeReversedOrNull(objects) {
  const merged = mergeReversed(objects)
  return Object.keys(merged).length > 0 ? merged : null
}

export function mergeAsReversedArrays(objects) {
  const res = {}
  for (const object of objects) {
    for (const key in object) {
      const value = object[key]
      if (key in res) {
        res[key].unshift(value)
      } else {
        res[key] = [value]
      }
    }
  }
  return res
}

export function getInheritanceChain(object) {
  // Returns an array of objects from the inheritance chain of `object`,
  // starting with the object itself and ending at `Object.prototype`.
  const chain = []
  let current = object
  while (current && current !== Object.prototype) {
    chain.push(current)
    current = Object.getPrototypeOf(current)
  }
  return chain
}

export function setupPropertyInheritance(object, key, baseValue = null) {
  // Loops through the inheritance chain of `object` and sets up a related
  // inheritance chain for the given property `key`, ending in `baseValue`.
  // The resulting value with proper inheritance is returned.
  const chain = getInheritanceChain(object)
  for (const [index, current] of chain.entries()) {
    if (current.hasOwnProperty(key)) {
      const parentValue = chain[index + 1]?.[key] || baseValue
      if (parentValue) {
        Object.setPrototypeOf(current[key], parentValue)
      }
    }
  }
  if (baseValue && !(key in object)) {
    // If there wasn't any override in the chain, and we have a baseValue,
    // set up direct inheritance from that now.
    object[key] = Object.setPrototypeOf({}, baseValue)
  }
  return object[key]
}
