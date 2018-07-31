import { isObject, isFunction } from '@ditojs/utils'
import { QueryFilters } from '@/query'
import { mergeAsArrays } from '@/utils'
import { ModelError } from '@/errors'

export default function filters(values) {
  // Use mergeAsArrays() to keep lists of filters to be inherited per scope,
  // so they can be called in sequence.
  const filterArrays = mergeAsArrays(values)
  const filters = {}
  for (const [name, array] of Object.entries(filterArrays)) {
    // Convert array of inherited filter definitions to filter functions,
    // including parameter validation.
    const functions = array
      .reverse() // Reverse to go from super-class to sub-class.
      .map(filter => {
        let func
        if (isFunction(filter)) {
          func = filter
        } else if (isObject(filter)) {
          // Convert QueryFilters to normal filter functions
          const queryFilter = QueryFilters.get(filter.filter)
          if (queryFilter) {
            const { properties } = filter
            func = properties
              ? (builder, ...args) => {
                // When the filter provides multiple properties, match them
                // all, but combine the expressions with OR.
                for (const property of properties) {
                  builder.orWhere(function() {
                    queryFilter(this, property, ...args)
                  })
                }
              }
              : (builder, ...args) => {
                queryFilter(builder, name, ...args)
              }
            // Copy over @parameters() settings
            func.parameters = queryFilter.parameters
          } else {
            throw new ModelError(this,
              `Invalid filter '${name}': Unknown filter type '${
                filter.filter}'.`
            )
          }
        }
        // If parameters are defined, wrap the function in a closure that
        // performs parameter validation...
        const rootName = 'query'
        const validator = func && this.app.compileParametersValidator(
          func.parameters,
          { ...func.options, rootName }
        )
        if (validator) {
          return (query, ...args) => {
            // Convert args to object for validation:
            const object = {}
            let index = 0
            for (const { name } of validator.list) {
              // Use rootName if no name is given, see:
              // Application.compileParametersValidator()
              object[name || rootName] = args[index++]
            }
            const errors = validator.validate(object)
            if (errors) {
              throw this.app.createValidationError({
                type: 'FilterValidation',
                message:
                  `The provided data for query filter '${name}' is not valid`,
                errors: this.app.validator.prefixDataPaths(
                  errors,
                  `.${name}`
                )
              })
            }
            return func(query, ...args)
          }
        }
        // ...otherwise use the defined function unmodified.
        return func
      })
    // Now define the filter as a function that calls all inherited filter
    // functions.
    filters[name] = (query, ...args) => {
      for (const func of functions) {
        func(query, ...args)
      }
      return query
    }
  }
  return filters
}
