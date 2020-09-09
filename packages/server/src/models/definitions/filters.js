import { isObject, isFunction } from '@ditojs/utils'
import { QueryFilters } from '@/query'
import { mergeAsReversedArrays } from '@/utils'
import { ModelError } from '@/errors'

export default function filters(values) {
  // Use mergeAsReversedArrays() to keep lists of filters to be inherited per
  // scope, so they can be called in sequence.
  const filterArrays = mergeAsReversedArrays(values)
  const filters = {}
  for (const [name, array] of Object.entries(filterArrays)) {
    // Convert array of inherited filter definitions to filter functions,
    // including parameter validation.
    const functions = array
      .map(definition => {
        let func
        if (isFunction(definition)) {
          func = definition
        } else if (isObject(definition)) {
          const { filter } = definition
          if (isFunction(filter)) {
            func = filter
            func.parameters = definition.parameters
            func.validate = definition.validate
          } else {
            // Convert QueryFilters to normal filter functions
            const queryFilter = QueryFilters.get(filter)
            if (!queryFilter) {
              throw new ModelError(this,
                `Invalid filter '${name}': Unknown filter type '${filter}'.`
              )
            }
            const { properties } = definition
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
            // Copy over @parameters() and @validate() settings
            func.parameters = queryFilter.parameters
            func.validate = queryFilter.validate
          }
        }
        // If parameters are defined, wrap the function in a closure that
        // performs parameter validation...
        const rootName = 'query'
        const validator = func && this.app.compileParametersValidator(
          func.parameters,
          { ...func.validate, rootName }
        )
        if (validator?.validate) {
          return (query, ...args) => {
            // Convert args to object for validation:
            const object = {}
            let index = 0
            for (const { name } of validator.list) {
              // Use rootName if no name is given, see:
              // Application.compileParametersValidator()
              object[name || rootName] = args[index++]
            }
            try {
              validator.validate(object)
            } catch (error) {
              throw this.app.createValidationError({
                type: 'FilterValidation',
                message:
                  `The provided data for query filter '${name}' is not valid`,
                errors: this.app.validator.prefixDataPaths(
                  error.errors,
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
