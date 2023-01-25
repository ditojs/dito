import {
  isArray, isObject, isDate, isRegExp, isFunction, isPromise
} from '../base/index.js'
import { pick } from './pick.js'

export function clone(value, options) {
  const {
    shallow = false,
    enumerable = true,
    descriptors = !enumerable,
    transferables = null,
    processValue = null
  } = isFunction(options)
    ? { processValue: options } // TODO: `callback` deprecated in December 2022.
    : options || {}

  const clones = new Map()

  const storeClone = (value, copy) => {
    clones.set(value, copy)
    return copy
  }

  const handleValue = value => {
    return shallow || transferables?.includes(value) ? value
      : clones.has(value) ? clones.get(value)
      : cloneValue(value)
  }

  const cloneValue = value => {
    let copy = value
    if (isDate(value)) {
      copy = storeClone(value, new value.constructor(+value))
    } else if (isRegExp(value)) {
      copy = storeClone(value, new value.constructor(value))
    } else if (isArray(value)) {
      copy = storeClone(value, new value.constructor(value.length))
      for (let i = 0, l = value.length; i < l; i++) {
        copy[i] = handleValue(value[i])
      }
    } else if (isObject(value)) {
    // Rely on arg.clone() if it exists and assume it creates an actual clone.
      if (isFunction(value.clone)) {
        copy = storeClone(value, value.clone(options))
      } else if (isPromise(value)) {
      // https://stackoverflow.com/questions/37063293/can-i-clone-a-promise
        copy = storeClone(value, value.then())
      } else {
      // Prevent calling the actual constructor since it is not guaranteed to
      // work as intended here, and only clone the non-inherited own properties.
        copy = storeClone(value, Object.create(Object.getPrototypeOf(value)))
        clones.set(value, copy)
        const keys = enumerable ? Object.keys(value) : Reflect.ownKeys(value)
        for (const key of keys) {
          if (descriptors) {
            const desc = Reflect.getOwnPropertyDescriptor(value, key)
            if (desc.value != null) {
              desc.value = handleValue(desc.value)
            }
            Reflect.defineProperty(copy, key, desc)
          } else {
            copy[key] = handleValue(value[key])
          }
        }
      }
    }
    return pick(processValue?.(copy), copy)
  }

  return cloneValue(value)
}
