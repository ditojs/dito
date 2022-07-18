import { isObject, isFunction } from '@ditojs/utils'
import { ModelError } from '../../errors/index.js'
import { mergeReversed } from '../../utils/index.js'

export default function scopes(values) {
  const scopes = {}
  // Use mergeAsReversedArrays() to keep lists of filters to be inherited per
  // scope, so they can be called in sequence.
  for (const [name, scope] of Object.entries(mergeReversed(values))) {
    const func = isFunction(scope)
      ? scope
      : isObject(scope)
        ? query => query.find(scope)
        : null
    if (!func) {
      throw new Error(`Invalid scope '${name}': ${scope}.`)
    }

    const parentModelClass = Object.getPrototypeOf(this)

    const applyParentScope = query => {
      const parentScope = parentModelClass.getScope(name)
      if (!parentScope) {
        throw new ModelError(this, `Undefined parent scope: '${name}'`)
      }
      parentScope(query)
      return query
    }

    scopes[name] = query => {
      func(query, applyParentScope)
      return query
    }
  }
  return scopes
}
