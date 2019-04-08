import { is, isArray, isObject } from '@/base'

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
