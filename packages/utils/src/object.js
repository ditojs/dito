export const { isArray } = Array

const { toString } = Object.prototype

export function isObject(val) {
  return val && toString.call(val) === '[object Object]'
}

export function isDate(val) {
  return val && toString.call(val) === '[object Date]'
}

export function isPlainObject(val) {
  const ctor = val?.constructor
  // We also need to check for ctor.name === 'Object', in case this is an object
  // from another global scope (e.g. another vm context in Node.js).
  return ctor && (ctor === Object || ctor.name === 'Object')
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
  return fun?.[Symbol.toStringTag] === 'AsyncFunction'
}

export function isPromise(obj) {
  return obj && isFunction(obj.then)
}

export function asArray(val) {
  return isArray(val) ? val : [val]
}

export function asFunction(val) {
  return isFunction(val) ? val : () => val
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

export function equals(obj1, obj2) {
  if (obj1 === obj2) {
    return true
  }
  if (obj1 && obj2) {
    if (isArray(obj1) && isArray(obj2)) {
      let { length } = obj1
      if (length === obj2.length) {
        while (length--) {
          if (!equals(obj1[length], obj2[length])) {
            return false
          }
        }
        return true
      }
    } else if (isObject(obj1) && isObject(obj2)) {
      const keys = Object.keys(obj1)
      if (keys.length === Object.keys(obj2).length) {
        for (const key of keys) {
          if (!(obj2.hasOwnProperty(key) && equals(obj1[key], obj2[key]))) {
            return false
          }
        }
        return true
      }
    }
  }
  return false
}

export function deepMerge(target, ...sources) {
  if (target && sources.length) {
    for (const source of sources) {
      if (isArray(source)) {
        for (const value of source) {
          target.push(value)
        }
      } else if (isObject(source)) {
        for (const key in source) {
          let value = source[key]
          if (isArray(value)) {
            value = deepMerge(target[key] || [], value)
          } else if (isObject(value)) {
            value = deepMerge(target[key] || {}, value)
          }
          target[key] = value
        }
      }
    }
  }
  return target
}
