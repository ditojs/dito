import SchemaContext from '../../SchemaContext.js'
import * as validators from '../../validators/index.js'
import {
  isFunction,
  isString,
  isRegExp,
  asArray,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import { getTypeDescriptor } from './types.ts'
import {
  getSchemaValue,
  shouldRenderSchema,
  walkSchemaData
} from './data.js'

export function getValidations(context) {
  const { schema } = context
  const validations = {
    ...getTypeDescriptor(schema)?.getValidations?.(context)
  }
  if (getSchemaValue('required', { type: Boolean, schema, context })) {
    validations.required = true
  }
  const { validate } = schema
  if (validate) {
    // Pass the validated value, after `formatValue()` like the components:
    validations.validate = value => validate(context.extend({ value }))
  }
  // `schema.rules` override and add rules, `false` and `undefined` remove them:
  for (const [name, setting] of Object.entries(schema.rules || {})) {
    if (setting === undefined || setting === false) {
      delete validations[name]
    } else {
      validations[name] = setting
    }
  }
  return validations
}

// Return errors in the format of server errors, `[{ message }]`:
export function getValueValidationErrors(value, validations) {
  const errors = []
  for (const [name, setting] of Object.entries(validations)) {
    const validator = getValidator(name)
    if (
      validator &&
      // Apply all validators except 'required' only to non-empty values:
      (name === 'required' || value != null && value !== '')
    ) {
      const { validate, message } = validator
      const result = validate(value, setting, validations)
      // Validators fail with a falsy result, or with their own message:
      if (!result || isString(result)) {
        errors.push({
          message: isString(result)
            ? result
            : isFunction(message)
              ? message(value, setting, validations)
              : message
        })
      }
    }
  }
  return errors
}

const warnedUnknownValidatorNames = new Set()

// Warn once per name about unknown validators, e.g. misspelled `schema.rules`:
function getValidator(name) {
  // eslint-disable-next-line import/namespace
  const validator = validators[name] ?? null
  if (!validator && !warnedUnknownValidatorNames.has(name)) {
    warnedUnknownValidatorNames.add(name)
    console.warn(`Unknown validator '${name}' is ignored.`)
  }
  return validator
}

// Return errors like the server, `{ [dataPath]: [{ message }] }`. Components
// that `shouldValidate()` rejects aren't walked, nor the ones they hold:
/**
 * @param {Record<string, any>} schema
 * @param {Record<string, any>} data
 * @param {Record<string, any>} [options]
 */
export function getDataValidationErrors(schema, data, {
  dataPath = '',
  services = null,
  rootData = data,
  shouldValidate = () => true
} = {}) {
  let errors = null

  // The same contexts as the rendered components get:
  const createContext = entry =>
    SchemaContext.createForSchema(services, { ...entry, rootData })

  const shouldWalk = entry => (
    shouldValidate(entry) &&
    shouldRenderSchema(entry.schema, createContext(entry))
  )

  const before = entry => {
    const { schema, data, name, dataPath } = entry
    const context = createContext(entry)
    let value = data[name]
    // Validate the value as displayed, like the components do:
    const { formatValue } = schema
    if (formatValue) {
      value = formatValue(context)
    }
    const validations = getValidations(context)
    const valueErrors = getValueValidationErrors(value, validations)
    if (valueErrors.length > 0) {
      errors ||= {}
      errors[dataPath] = valueErrors
    }
  }

  walkSchemaData(schema, data, {
    dataPath,
    shouldWalk,
    shouldSkipSourcesWithResource: true,
    before,
    options: { services, rootData }
  })
  return errors
}

export function getMatchingValidationErrors(errors, match) {
  const isMatchingDataPath = getDataPathMatcher(match)
  const matchingEntries = Object.entries(errors || {}).filter(
    ([dataPath]) => isMatchingDataPath(dataPath)
  )
  return matchingEntries.length > 0
    ? Object.fromEntries(matchingEntries)
    : null
}

// Match data paths with a function, a regular expression, or data paths with
// `*` for one level and `**` for zero or more levels, or for what's inside at
// the end, like `@ditojs/utils`:
export function getDataPathMatcher(match) {
  if (isFunction(match)) {
    return match
  } else if (isRegExp(match)) {
    return dataPath => match.test(dataPath)
  } else {
    const patterns = asArray(match).map(
      pattern => parseDataPath(normalizeDataPath(pattern))
    )
    return dataPath => {
      const path = parseDataPath(dataPath)
      return patterns.some(pattern => isMatchingPath(pattern, path))
    }
  }
}

function isMatchingPath(pattern, path) {
  const [part, ...patternRest] = pattern
  const [token, ...pathRest] = path
  if (part === '**') {
    // Match zero levels with the rest, or consume one level and match more.
    // At the end, match what's inside only:
    return patternRest.length > 0
      ? isMatchingPath(patternRest, path) ||
        path.length > 0 && isMatchingPath(pattern, pathRest)
      : path.length > 0
  } else if (part === undefined || token === undefined) {
    return part === token
  } else {
    return (
      (part === '*' || part === token) &&
      isMatchingPath(patternRest, pathRest)
    )
  }
}
