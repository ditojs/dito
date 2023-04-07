import {
  isArray,
  isObject,
  isString,
  isBoolean,
  isNumber,
  isFunction,
  isDate,
  isRegExp,
  asArray
} from '@ditojs/utils'

const typeCheckers = {
  Boolean: isBoolean,
  Number: isNumber,
  String: isString,
  Date: isDate,
  Array: isArray,
  Object: isObject,
  RegExp: isRegExp,
  Function: isFunction
}

// Declare these separately from the `typeConverters` object, to prevent
// Babel issues with `Object` overriding the global `Object`:
const toBoolean = value => !!value
const toNumber = value => +value
const toString = value => String(value)

const toDate = value =>
  isDate(value)
    ? value
    : new Date(value)

const toArray = value =>
  isArray(value)
    ? value
    : isString(value)
      ? value.split(',')
      : asArray(value)

const toObject = value =>
  isObject(value)
    ? value
    : // If a Object is expected but a Boolean provide, convert to an empty
      // object. Used by `creatable` & co, that can be both.
      value === true
      ? {}
      : null

const toRegExp = value =>
  isRegExp(value)
    ? value
    : new RegExp(value)

const typeConverters = {
  Boolean: toBoolean,
  Number: toNumber,
  String: toString,
  Date: toDate,
  Array: toArray,
  Object: toObject,
  RegExp: toRegExp
}

export function isMatchingType(types, value) {
  // See if any of the expect types match, return immediately if they do:
  if (types && value != null) {
    for (const type of types) {
      if (typeCheckers[type.name]?.(value)) {
        return true
      }
    }
  }
  return false
}

export function convertType(type, value) {
  const converter = type && typeConverters[type.name || type]
  return converter ? converter(value) : value
}
