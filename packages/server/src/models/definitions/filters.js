import { isObject, isFunction } from '@ditojs/utils'
import { QueryFilters } from '@/query'
import { mergeReversed } from '@/utils'

export default function filters(values) {
  const filters = {}
  for (const [name, definition] of Object.entries(mergeReversed(values))) {
    const filter = isFunction(definition)
      ? definition
      : isObject(definition)
        ? convertFilterObject(definition, name)
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

function convertFilterObject(definition, name) {
  const { filter, properties } = definition
  if (isFunction(filter)) {
    return addFunctionSettings(filter, definition)
  } else {
    // Convert QueryFilters to normal filter functions
    const queryFilter = QueryFilters.get(filter)
    if (!queryFilter) {
      throw new Error(
        `Invalid filter '${name}': Unknown filter type '${filter}'.`
      )
    }
    const func = properties
      ? (query, ...args) => {
        // When the filter provides multiple properties, match them
        // all, but combine the expressions with OR.
        for (const property of properties) {
          query.orWhere(query => queryFilter(query, property, ...args))
        }
      }
      : (query, ...args) => {
        queryFilter(query, name, ...args)
      }
    return addFunctionSettings(func, queryFilter)
  }
}

function addFunctionSettings(filter, definition) {
  // Copy over @parameters() and @validate() settings
  filter.parameters = definition.parameters
  filter.validate = definition.validate
  return filter
}

function wrapWithValidation(filter, name, app) {
  // If parameters are defined, wrap the function in a closure that
  // performs parameter validation...
  const dataName = 'query'
  const validator = filter && app.compileParametersValidator(
    filter.parameters,
    { ...filter.validate, dataName }
  )
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
          errors: app.validator.prefixDataPaths(
            error.errors,
            `.${name}`
          )
        })
      }
      return filter(query, ...args)
    }
  }
  // ...otherwise use the defined filter function unmodified.
  return filter
}
