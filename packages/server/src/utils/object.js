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

export function mapValues(obj, callback) {
  return Object.entries(obj).reduce((res, [key, value]) => {
    res[key] = callback(value, key)
    return res
  }, {})
}

function deepMergeWithDirection(unshift, target, sources) {
  if (target && sources.length) {
    for (const source of sources) {
      if (isObject(source) && isObject(target)) {
        const before = unshift && { ...target }
        for (const key in source) {
          const value = source[key]
          target[key] = deepMerge(
            target[key] || (
              isArray(value) && [] ||
              isObject(value) && {}
            ), value) || value
        }
        if (unshift) {
          // "unshift" the added fields by deleting the fields that were there
          // before and inserting them again at the end.
          for (const key in before) {
            delete target[key]
            target[key] = before[key]
          }
        }
      } else if (isArray(source) && isArray(target)) {
        const dest = unshift ? [] : target
        for (const value of source) {
          if (!target.includes(value)) {
            dest.push(value)
          }
        }
        if (unshift) {
          target.unshift(...dest)
        }
      }
    }
  }
  return target
}

export function deepMerge(target, ...sources) {
  return deepMergeWithDirection(false, target, sources)
}

export function deepMergeUnshift(target, ...sources) {
  return deepMergeWithDirection(true, target, sources)
}
