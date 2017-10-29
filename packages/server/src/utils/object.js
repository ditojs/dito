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

export function pick(...args) {
  for (const arg of args) {
    if (arg !== undefined) {
      return arg
    }
  }
}

export function mapValues(obj, callback) {
  return Object.entries(obj).reduce((res, [key, value]) => {
    res[key] = callback(value, key)
    return res
  }, {})
}

export function deepMerge(target, ...sources) {
  if (target && sources.length) {
    for (const source of sources) {
      if (isObject(source) && isObject(target)) {
        for (const key in source) {
          const value = source[key]
          target[key] = deepMerge(
            target[key] || (
              isArray(value) && [] ||
              isObject(value) && {}
            ), value) || value
        }
      } else if (isArray(source) && isArray(target)) {
        for (const value of source) {
          if (!target.includes(value)) {
            target.push(value)
          }
        }
      }
    }
  }
  return target
}
