import { isObject, isFunction } from '@ditojs/utils'
import { mergeAsReversedArrays } from '@/utils'
import { ModelError } from '@/errors'

export default function scopes(values) {
  // Use mergeAsReversedArrays() to keep lists of filters to be inherited per
  // scope, so they can be called in sequence.
  const scopeArrays = mergeAsReversedArrays(values)
  const scopes = {}
  for (const [scope, array] of Object.entries(scopeArrays)) {
    // Convert array of inherited scope definitions to scope functions.
    const functions = array
      .map(
        value => {
          let func
          if (isFunction(value)) {
            func = value
          } else if (isObject(value)) {
            func = query => query.find(value)
          } else {
            throw new ModelError(this,
              `Invalid scope '${scope}': Invalid scope type: ${value}.`
            )
          }
          return func
        }
      )
    // Now define the scope as a function that calls all inherited scope
    // functions.
    scopes[scope] = query => {
      for (const func of functions) {
        func(query)
      }
      return query
    }
    // Also register the eagerly applied versions of each scope as modifiers:
    // TODO: Once `modifierNotFound()`is implemented, we could use it to handle
    // the application of eager scopes globally without having to provide eager
    // modifiers here. See `QueryBuilder._applyScope()`:
    const name = `^${scope}`
    scopes[name] = query => query.applyScope(name)
  }
  return scopes
}
