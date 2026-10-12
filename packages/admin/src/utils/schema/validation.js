import SchemaContext from '../../SchemaContext.js'
import * as validators from '../../validators/index.js'
import { isFunction, isRegExp, asArray, normalizeDataPath } from '@ditojs/utils'
import { getTypeDescriptor } from './types.ts'
import {
  getSchemaValue,
  shouldRenderSchema,
  walkSchemaData
} from './data.js'

export function getValidations(schema, context) {
  const validations = {
    ...getTypeDescriptor(schema)?.getValidations?.(schema, context)
  }
  if (getSchemaValue('required', { type: Boolean, schema, context })) {
    validations.required = true
  }
  // `schema.rules` override and add rules, and `undefined` removes them:
  for (const [name, setting] of Object.entries(schema.rules || {})) {
    if (setting === undefined) {
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
      if (!validate(value, setting, validations)) {
        errors.push({
          message: isFunction(message)
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

// Return errors like the server, `{ [dataPath]: [{ message }] }`:
/**
 * @param {Record<string, any>} schema
 * @param {Record<string, any>} data
 * @param {Record<string, any>} [options]
 */
export function getDataValidationErrors(schema, data, {
  dataPath = '',
  services = null,
  rootData = data
} = {}) {
  let errors = null

  const createContext = ({ schema, data, name, dataPath }) =>
    new SchemaContext(services, {
      schema,
      value: name != null ? data[name] : undefined,
      name,
      data,
      dataPath,
      rootData
    })

  const shouldWalk = entry =>
    shouldRenderSchema(entry.schema, createContext(entry))

  const before = entry => {
    const { schema, data, name, dataPath } = entry
    const context = createContext(entry)
    let value = data[name]
    // Validate the value as displayed, like the components do:
    const { format } = schema
    if (isFunction(format)) {
      value = format(context)
    }
    const validations = getValidations(schema, context)
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
  let isMatchingDataPath
  if (isFunction(match)) {
    isMatchingDataPath = match
  } else if (isRegExp(match)) {
    isMatchingDataPath = dataPath => match.test(dataPath)
  } else {
    const dataPaths = asArray(match).map(normalizeDataPath)
    isMatchingDataPath = dataPath => dataPaths.includes(dataPath)
  }
  const matchingEntries = Object.entries(errors || {}).filter(
    ([dataPath]) => isMatchingDataPath(dataPath)
  )
  return matchingEntries.length > 0
    ? Object.fromEntries(matchingEntries)
    : null
}
