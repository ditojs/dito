export const { isArray } = Array

export function isObject(val) {
  return val != null && typeof val === 'object' && isArray(val) === false
}

export function isPlainObject(val) {
  return val != null && val.constructor === Object
}

export function isFunction(val) {
  return typeof val === 'function'
}

export function isString(val) {
  return typeof val === 'string'
}

export function isBoolean(val) {
  return typeof val === 'boolean'
}

export function isAsync(fun) {
  return fun && fun[Symbol.toStringTag] === 'AsyncFunction'
}

export function asArray(obj) {
  return isArray(obj) ? obj : [obj]
}

export function copyProperty(dest, src, name) {
  return src ? Object.defineProperty(dest, name,
    Object.getOwnPropertyDescriptor(src, name)) : dest
}

export function copyProperties(dest, src) {
  return src ? Object.defineProperties(dest,
    Object.getOwnPropertyDescriptors(src)) : dest
}

export function clone(obj) {
  return obj != null ? JSON.parse(JSON.stringify(obj)) : obj
}

export function deepFreeze(obj) {
  Object.freeze(obj)
  for (const key of Object.getOwnPropertyNames(obj)) {
    const value = obj[key]
    if (isObject(value) && !Object.isFrozen(value)) {
      deepFreeze(value)
    }
  }
  return obj
}

export function defineReadOnly(object, name, value) {
  Object.defineProperty(object, name, {
    value,
    writable: false
  })
}
