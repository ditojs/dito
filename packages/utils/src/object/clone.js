import { isArray, isObject, isDate, isRegExp, isFunction } from '@/base'
import { pick } from '@/object'

export function clone(arg, callback = null) {
  let copy
  if (isDate(arg)) {
    copy = new arg.constructor(+arg)
  } else if (isRegExp(arg)) {
    copy = new arg.constructor(arg)
  } else if (isArray(arg)) {
    copy = new arg.constructor(arg.length)
    for (let i = 0, l = arg.length; i < l; i++) {
      copy[i] = clone(arg[i], callback)
    }
  } else if (isObject(arg)) {
    // Rely on arg.clone() if it exists and assume it creates an actual clone.
    if (isFunction(arg.clone)) {
      copy = arg.clone()
    } else {
      // Prevent calling the actual constructor since it is not guaranteed to
      // work as intended here, and only clone the non-inherited own properties.
      copy = Object.create(Object.getPrototypeOf(arg))
      for (const key of Object.keys(arg)) {
        copy[key] = clone(arg[key], callback)
      }
    }
  } else {
    copy = arg
  }
  return pick(callback?.(copy), copy)
}
