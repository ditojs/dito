import { isObject, isFunction } from '@ditojs/utils'
import { mergeAsReversedArrays } from '@/utils'

export default function scopes(values) {
  const scopes = {}
  // Use mergeAsReversedArrays() to keep lists of filters to be inherited per
  // scope, so they can be called in sequence.
  for (const [scope, array] of Object.entries(mergeAsReversedArrays(values))) {
    // Convert array of inherited scope definitions to scope functions.
    const functions = array.map(value => {
      const func = getScope(value)
      if (!func) {
        throw new Error(`Invalid scope '${scope}': ${value}.`)
      }
      return func
    })
    // Now define the scope as a function that calls all inherited scope
    // functions.
    scopes[scope] = query => {
      for (const func of functions) {
        func(query)
      }
      return query
    }
  }
  return scopes
}

function getScope(value) {
  return isFunction(value)
    ? value
    : isObject(value)
      ? query => query.find(value)
      : null
}
