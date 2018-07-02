import { isArray, isObject, isFunction } from './base'

export const is = Object.is || (
  // SameValue algorithm:
  // eslint-disable-next-line no-self-compare
  (x, y) => x === y ? x !== 0 || 1 / x === 1 / y : x !== x && y !== y
)

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

export function equals(val1, val2) {
  if (val1 === val2) {
    return true
  }
  if (val1 != null && val2 != null) {
    val1 = val1.valueOf()
    val2 = val2.valueOf()
    if (is(val1, val2)) {
      return true
    }
    if (isArray(val1) && isArray(val2)) {
      let { length } = val1
      if (length === val2.length) {
        while (length--) {
          if (!equals(val1[length], val2[length])) {
            return false
          }
        }
        return true
      }
    } else if (isObject(val1) && isObject(val2)) {
      const keys = Object.keys(val1)
      if (keys.length === Object.keys(val2).length) {
        for (const key of keys) {
          if (!(val2.hasOwnProperty(key) && equals(val1[key], val2[key]))) {
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
  const merge = (target, source) => {
    if (target && source && (
      isObject(target) && isObject(source) ||
      isArray(target) && isArray(source)
    )) {
      for (const key in source) {
        const value = source[key]
        if (
          source.hasOwnProperty(key) &&
          !merge(target[key], value) &&
          (value !== undefined || !(key in target))
        ) {
          target[key] = clone(value)
        }
      }
      return true
    }
    return false
  }

  for (const source of sources) {
    merge(target, source)
  }
  return target
}

function getCallback(iteratee) {
  return isFunction(iteratee)
    ? iteratee
    : object => object[iteratee]
}

export function groupBy(collection, iteratee) {
  const callback = getCallback(iteratee)
  const array = isArray(collection)
    ? collection
    : Object.values(collection)
  return array.reduce((groups, item) => {
    const key = callback(item)
    const group = groups[key] || (groups[key] = [])
    group.push(item)
    return groups
  }, {})
}

export function mapKeys(object, iteratee) {
  const callback = getCallback(iteratee)
  return Object.keys(object).reduce((mapped, key) => {
    const value = object[key]
    mapped[callback(value, key, object)] = value
    return mapped
  }, {})
}

export function mapValues(object, iteratee) {
  const callback = getCallback(iteratee)
  return Object.keys(object).reduce((mapped, key) => {
    mapped[key] = callback(object[key], key, object)
    return mapped
  }, {})
}
