import { isObject } from '@ditojs/utils'
import { parseHandlerDefinition } from '../../utils/handler.js'
import { mergeReversed } from '../../utils/object.js'
import { QueryFilters } from '../../query/index.js'
import { ParameterValidator } from '../../app/ParameterValidator.js'

export default function filters(values) {
  const filters = {}
  for (const [name, definition] of Object.entries(mergeReversed(values))) {
    const descriptor = parseFilterDefinition(name, definition)
    if (!descriptor) {
      throw new Error(
        `Invalid filter '${name}': Unrecognized definition: ${definition}.`
      )
    }
    filters[name] = wrapWithValidation(descriptor, name, this.app)
  }
  return filters
}

function parseFilterDefinition(name, definition) {
  const { filter, properties } = isObject(definition) ? definition : {}
  if (!filter) {
    return parseHandlerDefinition(definition)
  }
  // Convert QueryFilter to normal filter function.
  const queryFilter = QueryFilters.get(filter)
  if (!queryFilter) {
    throw new Error(
      `Invalid filter '${name}': Unknown filter type '${filter}'.`
    )
  }
  // Support both object and function definitions.
  const { handler: queryHandler, ...descriptor } =
    parseHandlerDefinition(queryFilter)
  const handler = properties
    ? (query, ...args) => {
        // When the filter provides multiple properties, match them
        // all, but combine the expressions with OR.
        for (const property of properties) {
          query.orWhere(query => queryHandler(query, property, ...args))
        }
      }
    : (query, ...args) => {
        queryHandler(query, name, ...args)
      }
  return { ...descriptor, handler }
}

function wrapWithValidation({ handler, parameters, options }, name, app) {
  // TODO: Implement `response` validation for filters too.
  const validator = parameters
    ? new ParameterValidator(app, parameters, {
        ...options.parameters,
        dataName: 'query'
      })
    : null
  if (!validator?.validate) {
    // Without parameters, use the defined filter function unmodified.
    return handler
  }
  // Otherwise wrap the function in a closure that coerces and validates the
  // parameters.
  const keys = validator.list.map(parameter =>
    validator.getParameterKey(parameter)
  )
  return (query, ...args) => {
    // Convert args to object for validation:
    const object = Object.fromEntries(
      keys.map((key, index) => [key, args[index]])
    )
    const errors = validator.validateParameters(object)
    if (errors.length > 0) {
      throw app.createValidationError({
        type: 'FilterValidation',
        message: `The provided data for query filter '${name}' is not valid`,
        errors: app.validator.prefixInstancePaths(errors, `.${name}`)
      })
    }
    return validator.asObject
      ? handler(query, object)
      : // Pass on the coerced values, followed by any additional arguments.
        handler(
          query,
          ...keys.map(key => object[key]),
          ...args.slice(keys.length)
        )
  }
}
