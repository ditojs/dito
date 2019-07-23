import {
  isArray, isString, isBoolean, isNumber, isFunction, isDate, isRegExp, asArray
} from '@ditojs/utils'

const typeCheckers = {
  Boolean: value => isBoolean(value),
  Number: value => isNumber(value),
  String: value => isString(value),
  Date: value => isDate(value),
  Array: value => isArray(value),
  RegExp: value => isRegExp(value),
  Function: value => isFunction(value)
}

const typeConverters = {
  Boolean: value => !!value,
  Number: value => +value,
  String: value => isString(value) ? value : `${value}`,
  Date: value => isDate(value) ? value : new Date(value),
  Array: value => isArray(value)
    ? value
    : isString(value)
      ? value.split(',')
      : asArray(value),
  RegExp: value => isRegExp(value)
    ? value
    : new RegExp(value)
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
