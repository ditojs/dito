export const { isArray } = Array
const { toString } = Object.prototype

export const is = Object.is || (
  // SameValue algorithm:
  // istanbul ignore next
  // eslint-disable-next-line no-self-compare
  (x, y) => x === y ? x !== 0 || 1 / x === 1 / y : x !== x && y !== y
)

export function isPlainObject(val) {
  const ctor = val?.constructor
  // We also need to check for ctor.name === 'Object', in case this is an object
  // from another global scope (e.g. another vm context in Node.js).
  // When an value has no constructor, it was created with `Object.create(null)`
  return !ctor || (ctor === Object || ctor.name === 'Object')
}

export function isObject(val) {
  return !!val && typeof val === 'object' && !isArray(val)
}

export function isFunction(val) {
  return !!val && typeof val === 'function'
}

function getPrimitiveCheck(name) {
  // Create checking function for all primitive types (number, string, boolean)
  // that also matches their Object wrappers. We can't check `valueOf()` returns
  // here because `new Date().valueOf()` also returns a number.
  const typeName = name.toLowerCase()
  const toStringName = `[object ${name}]`
  return function(val) {
    const type = typeof val
    return (
      type === typeName ||
      !!val && type === 'object' && toString.call(val) === toStringName
    )
  }
}

export const isNumber = getPrimitiveCheck('Number')

export const isString = getPrimitiveCheck('String')

export const isBoolean = getPrimitiveCheck('Boolean')

export function isDate(val) {
  return !!val && toString.call(val) === '[object Date]'
}

export function isRegExp(val) {
  return !!val && toString.call(val) === '[object RegExp]'
}

export function isPromise(val) {
  return !!val && isFunction(val.then) && isFunction(val.catch)
}

export const isInteger = Number.isInteger || function isInteger(value) {
  return (
    isNumber(value) &&
    isFinite(value) &&
    Math.floor(value) === value
  )
}

export function isAsync(val) {
  return val?.[Symbol.toStringTag] === 'AsyncFunction'
}

export function asObject(val) {
  // http://2ality.com/2011/04/javascript-converting-any-value-to.html
  return val != null ? Object(val) : val
}

export function asArray(val) {
  return isArray(val) ? val : val !== undefined ? [val] : []
}

export function asFunction(val) {
  return isFunction(val) ? val : () => val
}
