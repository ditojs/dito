import { isArray, isObject, isDate, isRegExp } from '@/base'
import { pick } from '@/object'

export function clone(val, iteratee = null) {
  let copy
  if (isDate(val)) {
    copy = new val.constructor(+val)
  } else if (isRegExp(val)) {
    copy = new RegExp(val)
  } else if (isObject(val)) {
    copy = new val.constructor()
    for (const key in val) {
      copy[key] = clone(val[key], iteratee)
    }
  } else if (isArray(val)) {
    copy = new val.constructor(val.length)
    for (let i = 0, l = val.length; i < l; i++) {
      copy[i] = clone(val[i], iteratee)
    }
  } else {
    copy = val
  }
  return pick(iteratee?.(copy), copy)
}
