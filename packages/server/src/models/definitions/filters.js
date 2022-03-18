import { isObject, isFunction } from '@ditojs/utils'
import { mergeReversed, processHandlerParameters } from '../../utils/index.js'
import { QueryFilters } from '../../query/index.js'

export default function filters(values) {
  const filters = {}
  for (const [name, definition] of Object.entries(mergeReversed(values))) {
    const filter = isFunction(definition)
      ? definition
      : isObject(definition)
        ? convertFilterObject(name, definition)
        : null
    if (!filter) {
      throw new Error(
        `Invalid filter '${name}': Unrecognized definition: ${definition}.`
      )
    }
    filters[name] = wrapWithValidation(filter, name, this.app)
  }
  return filters
}

function convertFilterObject(name, object) {
  const addHandlerSettings = (handler, definition) => {
    // Copy over parameters, returns and their validation options settings.
    const { parameters, returns, ...rest } = definition
    processHandlerParameters(handler, 'parameters', parameters)
    processHandlerParameters(handler, 'returns', returns)
    return Object.assign(handler, rest)
  }

  const { handler, filter, properties } = object
  if (handler) {
    return addHandlerSettings(handler, object)
  } else if (filter) {
    // Convert QueryFilter to normal filter function.
    const queryFilter = QueryFilters.get(filter)
    if (!queryFilter) {
      throw new Error(
        `Invalid filter '${name}': Unknown filter type '${filter}'.`
      )
    }
    // Support both object and function definitions.
    const queryHandler = isObject(queryFilter)
      ? queryFilter.handler
      : queryFilter
    const func = properties
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
    return addHandlerSettings(func, queryFilter)
  }
}

function wrapWithValidation(filter, name, app) {
  if (filter) {
    // TODO: Implement `returns` validation for filters too.
    // TODO: Share additional coercion handling with
    // `ControllerAction#coerceValue()`
    const { parameters, options = {} } = filter
    // If parameters are defined, wrap the function in a closure that
    // performs parameter validation...
    const dataName = 'query'
    const validator = app.compileParametersValidator(parameters, {
      ...options.parameters,
      dataName
    })
    if (validator?.validate) {
      return (query, ...args) => {
      // Convert args to object for validation:
        const object = {}
        let index = 0
        for (const { name } of validator.list) {
        // Use dataName if no name is given, see:
        // Application.compileParametersValidator()
          object[name || dataName] = args[index++]
        }
        try {
          validator.validate(object)
        } catch (error) {
          throw app.createValidationError({
            type: 'FilterValidation',
            message:
            `The provided data for query filter '${name}' is not valid`,
            errors: app.validator.prefixInstancePaths(
              error.errors,
            `.${name}`
            )
          })
        }
        return validator.asObject
          ? filter(query, object)
          : filter(query, ...args)
      }
    }
  }
  // ...otherwise use the defined filter function unmodified.
  return filter
}
