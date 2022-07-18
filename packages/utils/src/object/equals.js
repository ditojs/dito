import { is, isArray, isObject } from '../base/index.js'

export function equals(arg1, arg2) {
  if (arg1 === arg2) {
    return true
  }
  if (arg1 != null && arg2 != null) {
    arg1 = arg1.valueOf()
    arg2 = arg2.valueOf()
    if (is(arg1, arg2)) {
      return true
    }
    if (isArray(arg1) && isArray(arg2)) {
      let { length } = arg1
      if (length === arg2.length) {
        while (length--) {
          if (!equals(arg1[length], arg2[length])) {
            return false
          }
        }
        return true
      }
    } else if (isObject(arg1) && isObject(arg2)) {
      const keys = Object.keys(arg1)
      if (keys.length === Object.keys(arg2).length) {
        for (const key of keys) {
          if (!(arg2.hasOwnProperty(key) && equals(arg1[key], arg2[key]))) {
            return false
          }
        }
        return true
      }
    }
  }
  return false
}
