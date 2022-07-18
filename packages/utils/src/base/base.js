export const { isArray } = Array
const { toString } = Object.prototype

export const is = Object.is || (
  // SameValue algorithm:
  // istanbul ignore next
  // eslint-disable-next-line no-self-compare
  (x, y) => x === y ? x !== 0 || 1 / x === 1 / y : x !== x && y !== y
)

export function isPlainObject(arg) {
  const ctor = arg?.constructor
  // We also need to check for ctor.name === 'Object', in case this is an object
  // from another global scope (e.g. another vm context in Node.js).
  // When an value has no constructor, it was created with `Object.create(null)`
  return !!arg && (
    ctor && (
      ctor === Object ||
      ctor.name === 'Object'
    ) || !ctor && !isModule(arg)
  )
}

export function isObject(arg) {
  return !!arg && typeof arg === 'object' && !isArray(arg)
}

export function isFunction(arg) {
  return !!arg && typeof arg === 'function'
}

function getPrimitiveCheck(name) {
  // Create checking function for all primitive types (number, string, boolean)
  // that also matches their Object wrappers. We can't check `valueOf()` returns
  // here because `new Date().valueOf()` also returns a number.
  const typeName = name.toLowerCase()
  const toStringName = `[object ${name}]`
  return function(arg) {
    const type = typeof arg
    return (
      type === typeName ||
      !!arg && type === 'object' && toString.call(arg) === toStringName
    )
  }
}

export const isModule = getPrimitiveCheck('Module')

export const isNumber = getPrimitiveCheck('Number')

export const isString = getPrimitiveCheck('String')

export const isBoolean = getPrimitiveCheck('Boolean')

export function isDate(arg) {
  return !!arg && toString.call(arg) === '[object Date]'
}

export function isRegExp(arg) {
  return !!arg && toString.call(arg) === '[object RegExp]'
}

export function isPromise(arg) {
  return !!arg && isFunction(arg.then) && isFunction(arg.catch)
}

export const isInteger = Number.isInteger || function isInteger(arg) {
  return (
    isNumber(arg) &&
    isFinite(arg) &&
    Math.floor(arg) === arg
  )
}

export function isAsync(arg) {
  return arg?.[Symbol.toStringTag] === 'AsyncFunction'
}

export function isArrayLike(arg) {
  const length = arg?.length
  return (
    length != null &&
    !isFunction(arg) &&
    isNumber(length) &&
    length >= 0 &&
    length <= Number.MAX_SAFE_INTEGER
  )
}

export function isEmpty(arg) {
  return arg == null ||
    isArrayLike(arg) && arg.length === 0 ||
    isObject(arg) && Object.keys(arg).length === 0
}

export function asObject(arg) {
  // http://2ality.com/2011/04/javascript-converting-any-value-to.html
  return arg != null ? Object(arg) : arg
}

export function asArray(arg) {
  return isArray(arg) ? arg : arg !== undefined ? [arg] : []
}

export function asFunction(arg) {
  return isFunction(arg) ? arg : () => arg
}
