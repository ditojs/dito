import {
  asArray,
  isArray,
  isBoolean,
  isNumber,
  isObject,
  isString
} from '@ditojs/utils'

// The JSON types, checked as Ajv does with `strictNumbers`, and their names in
// messages:
const types = {
  string: { validate: isString, name: 'a string' },
  number: {
    validate: value => isNumber(value) && isFinite(value),
    name: 'a number'
  },
  integer: {
    validate: value => Number.isInteger(value),
    name: 'a whole number'
  },
  boolean: { validate: isBoolean, name: 'a boolean' },
  null: { validate: value => value === null, name: 'null' },
  array: { validate: isArray, name: 'a list' },
  object: { validate: isObject, name: 'an object' }
}

export const type = {
  validate: (value, type) =>
    asArray(type).some(type => types[type].validate(value)),
  message: type => {
    const names = asArray(type).map(type => types[type].name)
    const last = names.pop()
    return `must be ${
      names.length > 0 ? `${names.join(', ')} or ${last}` : last
    }`
  }
}
