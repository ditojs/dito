import DitoContext from '../../DitoContext.js'
import * as validators from '../../validators/index.js'
import { isFunction, isRegExp, asArray, normalizeDataPath } from '@ditojs/utils'
import { getTypeOptions } from './types.js'
import {
  getSchemaValue,
  shouldRenderSchema,
  processSchemaData
} from './data.js'

/**
 * Returns the validations of a component schema, without requiring a
 * component: the validations of the type's static `getTypeValidations()`
 * option, `required`, and finally the `schema.rules` overrides, where
 * `undefined` removes a validation. Schema values are evaluated with `context`.
 */
export function getValidations(schema, context) {
  const validations = {
    ...getTypeOptions(schema)?.getTypeValidations?.(schema, context)
  }
  if (getSchemaValue('required', { type: Boolean, schema, context })) {
    validations.required = true
  }
  // Allow schema to override default rules and add any new ones:
  for (const [name, setting] of Object.entries(schema.rules || {})) {
    if (setting === undefined) {
      delete validations[name]
    } else {
      validations[name] = setting
    }
  }
  return validations
}

/**
 * Returns the errors of validating `value` against `validations`, in the
 * format of server errors, `[{ message }]`, with messages without the label
 * prefix, or an empty array if the value is valid.
 */
export function getValueValidationErrors(value, validations) {
  const errors = []
  for (const [name, setting] of Object.entries(validations)) {
    const validator = getValidator(name)
    if (
      validator &&
      // Only apply 'required' validator to empty values.
      // Apply all other validators only to non-empty values.
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

// The names of unknown validators that were warned about, see `getValidator()`:
const warnedUnknownValidatorNames = new Set()

// Returns the validator of the name, or `null` with a warning, once per name,
// e.g. for misspelled `schema.rules`.
function getValidator(name) {
  // eslint-disable-next-line import/namespace
  const validator = validators[name] ?? null
  if (!validator && !warnedUnknownValidatorNames.has(name)) {
    warnedUnknownValidatorNames.add(name)
    console.warn(`Unknown validator '${name}' is ignored.`)
  }
  return validator
}

/**
 * Validates `data` along the components of `schema`, including tabs, panels
 * and the nested forms of list and object items, skipping components whose
 * `if` evaluates to `false` and sources with their own resource. Returns the
 * errors in the format of server errors, `{ [dataPath]: [{ message }] }`, or
 * `null` if the data is valid.
 */
export function getDataValidationErrors(schema, data, {
  dataPath = '',
  component = null,
  rootData = data
} = {}) {
  let errors = null

  const createContext = ({ schema, data, name, dataPath }) =>
    new DitoContext(component, {
      schema,
      value: name != null ? data[name] : undefined,
      name,
      data,
      dataPath,
      rootData
    })

  const shouldProcess = entry =>
    shouldRenderSchema(entry.schema, createContext(entry))

  const before = entry => {
    const { schema, data, name, dataPath } = entry
    const context = createContext(entry)
    let value = data[name]
    // Validate the value as displayed, like the components do, see
    // `ValueMixin.value`:
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

  processSchemaData(schema, data, {
    dataPath,
    shouldProcess,
    shouldSkipSourcesWithResource: true,
    before,
    options: { component, rootData }
  })
  return errors
}

/**
 * Returns the entries of `errors` whose data paths match `match`, or `null` if
 * none match. `match` can be a function receiving the data path, a regular
 * expression, a data path, or an array of data paths.
 */
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
