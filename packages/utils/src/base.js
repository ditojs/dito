export const { isArray } = Array

const { toString, valueOf } = Object.prototype

export function isPlainObject(val) {
  const ctor = val?.constructor
  // We also need to check for ctor.name === 'Object', in case this is an object
  // from another global scope (e.g. another vm context in Node.js).
  // When an value has no constructor, it was created with `Object.create(null)`
  return !ctor || (ctor === Object || ctor.name === 'Object')
}

export function isObject(val) {
  return val && typeof val === 'object' && !isArray(val)
}

export function isFunction(val) {
  return val && typeof val === 'function'
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

export function isDate(val) {
  return val && toString.call(val) === '[object Date]'
}

export function isRegExp(val) {
  return val && toString.call(val) === '[object RegExp]'
}

export function isAsync(val) {
  return val?.[Symbol.toStringTag] === 'AsyncFunction'
}

export function isPromise(val) {
  return val && isFunction(val.then)
}

export function asObject(val) {
  // http://2ality.com/2011/04/javascript-converting-any-value-to.html
  return val != null ? valueOf.call(val) : val
}

export function asArray(val) {
  return isArray(val) ? val : val !== undefined ? [val] : []
}

export function asFunction(val) {
  return isFunction(val) ? val : () => val
}
