import DitoContext from '../../DitoContext.js'
import * as validators from '../../validators/index.js'
import { isFunction } from '@ditojs/utils'
import { getTypeOptions } from './types.js'
import {
  getSchemaValue,
  shouldRenderSchema,
  processSchemaData
} from './data.js'

/**
 * Returns the validation rules of a component schema, without requiring a
 * component: the rules of the type's static `getTypeValidationRules()` option,
 * `required`, and finally the `schema.rules` overrides, where `undefined`
 * removes a rule. Schema values are evaluated with `context`.
 */
export function getValidationRules(schema, context) {
  const rules = {
    ...getTypeOptions(schema)?.getTypeValidationRules?.(schema, context)
  }
  if (getSchemaValue('required', { type: Boolean, schema, context })) {
    rules.required = true
  }
  // Allow schema to override default rules and add any new ones:
  for (const [key, value] of Object.entries(schema.rules || {})) {
    if (value === undefined) {
      delete rules[key]
    } else {
      rules[key] = value
    }
  }
  return rules
}

/**
 * Returns the error messages of validating `value` against `rules`, without
 * the label prefix, or an empty array if the value is valid.
 */
export function getValidationMessages(value, rules) {
  const messages = []
  for (const [rule, setting] of Object.entries(rules)) {
    // eslint-disable-next-line import/namespace
    const validator = validators[rule]
    if (
      validator &&
      // Only apply 'required' validator to empty values.
      // Apply all other validators only to non-empty values.
      (rule === 'required' || value != null && value !== '')
    ) {
      const { validate, message } = validator
      if (!validate(value, setting, rules)) {
        messages.push(
          isFunction(message)
            ? message(value, setting, rules)
            : message
        )
      }
    }
  }
  return messages
}

/**
 * Validates `data` along the components of `schema`, including tabs, panels
 * and the nested forms of list and object items, skipping components whose
 * `if` evaluates to `false`. Returns the errors in the format of server
 * errors, `{ [dataPath]: [{ message }] }`, or `null` if the data is valid.
 */
export function validateData(schema, data, {
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

  const shouldProcessSchema = entry =>
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
    const rules = getValidationRules(schema, context)
    const messages = getValidationMessages(value, rules)
    if (messages.length > 0) {
      errors ||= {}
      errors[dataPath] = messages.map(message => ({ message }))
    }
  }

  processSchemaData(schema, data, {
    dataPath,
    shouldProcessSchema,
    before,
    options: { component, rootData }
  })
  return errors
}
