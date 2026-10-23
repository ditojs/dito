import { is, isArray, isObject, isTypedArray } from '../base/index.js'

const { toString } = Object.prototype

export function equals(arg1, arg2) {
  if (arg1 === arg2) {
    return true
  }
  if (arg1 != null && arg2 != null) {
    // Objects without prototype have no `valueOf()` to unwrap them with:
    arg1 = arg1.valueOf ? arg1.valueOf() : arg1
    arg2 = arg2.valueOf ? arg2.valueOf() : arg2
    if (is(arg1, arg2)) {
      return true
    }
    if (
      isArray(arg1) && isArray(arg2) ||
      isTypedArray(arg1) && isSameType(arg1, arg2)
    ) {
      let { length } = arg1
      if (length === arg2.length) {
        while (length--) {
          if (!equals(arg1[length], arg2[length])) {
            return false
          }
        }
        return true
      }
    } else if (isObject(arg1) && isObject(arg2) && isSameType(arg1, arg2)) {
      const keys = Object.keys(arg1)
      if (keys.length === Object.keys(arg2).length) {
        for (const key of keys) {
          if (!(Object.hasOwn(arg2, key) && equals(arg1[key], arg2[key]))) {
            return false
          }
        }
        return true
      }
    }
  }
  return false
}

function isSameType(arg1, arg2) {
  return (
    arg1.constructor === arg2.constructor ||
    toString.call(arg1) === toString.call(arg2)
  )
}
