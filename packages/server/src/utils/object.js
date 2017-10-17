export const { isArray } = Array

export function isObject(val) {
  return val && typeof val === 'object' && isArray(val) === false
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

export function isPromise(obj) {
  return isObject(obj) && isFunction(obj.then)
}

export function asArray(obj) {
  return isArray(obj) ? obj : [obj]
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
