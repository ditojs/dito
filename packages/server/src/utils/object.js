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
