export const { isArray } = Array

export function isObject(val) {
  return val && typeof val === 'object' && !isArray(val)
}

export function isString(val) {
  return typeof val === 'string'
}

export function isBoolean(val) {
  return typeof val === 'boolean'
}

export function isNumber(val) {
  return typeof val === 'number'
}

export function isFunction(val) {
  return typeof val === 'function'
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

export function pick(...args) {
  for (const arg of args) {
    if (arg !== undefined) {
      return arg
    }
  }
}

export function clone(obj) {
  return obj != null ? JSON.parse(JSON.stringify(obj)) : obj
}
