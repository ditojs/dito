import { isObject, isFunction, asArray } from '@ditojs/utils'
import { getInheritanceChain } from './object.js'

/**
 * Parses a handler definition into a plain descriptor, without modifying the
 * definition. Two forms are supported:
 * - A function, with optional settings as function properties, e.g.
 *   `handler.parameters = { ... }`.
 * - An object with a `handler` function and its settings, where `parameters`
 *   and `response` can also be provided as `[schema, options]` arrays.
 *
 * Any additional settings are collected in `extra`, e.g. `cached`, so they can
 * be passed on to application middleware.
 *
 * @param {Function|Object} definition the handler definition
 * @return {Object|null} the descriptor, or `null` if the definition doesn't
 *   provide a handler function
 */
export function parseHandlerDefinition(definition) {
  const isFunctionDefinition = isFunction(definition)
  if (!isFunctionDefinition && !isFunction(definition?.handler)) {
    return null
  }
  const {
    handler = definition,
    before = null,
    after = null,
    core = false,
    authorize = null,
    transacted = null,
    scope = null,
    parameters,
    response,
    options = {},
    ...extra
  } = isFunctionDefinition ? { ...definition } : definition

  // Leftovers of the former `returns` would otherwise be silently ignored,
  // skipping the validation of the response:
  if (extra.returns || options.returns) {
    throw new Error(
      `Unsupported 'returns' in handler definition, use 'response' instead.`
    )
  }

  // In the function form, `parameters` and `response` are always schemas,
  // with their validation options in `handler.options`. The object form also
  // supports `[schema, options]` arrays.
  const [parametersSchema, parametersOptions] = isFunctionDefinition
    ? [parameters]
    : asArray(parameters)
  const [responseSchema, responseOptions] = isFunctionDefinition
    ? [response]
    : asArray(response)

  return {
    handler,
    before,
    after,
    core,
    authorize,
    transacted,
    scope: scope ? asArray(scope) : null,
    parameters: parametersSchema ?? null,
    response: responseSchema ?? null,
    options: {
      parameters: { ...options.parameters, ...parametersOptions },
      response: { ...options.response, ...responseOptions }
    },
    extra
  }
}

// Replace object-form definitions on all levels of `values` with their
// handlers, so `super` finds functions, and let `super` in `handler()` reach
// the parent level. Parse them before, as they inherit from it afterwards:
export function convertHandlerDefinitions(values) {
  for (const level of getInheritanceChain(values)) {
    const definitions = definitionsByLevel.get(level) ?? {}
    for (const [key, definition] of Object.entries(level)) {
      if (isObject(definition) && isFunction(definition.handler)) {
        definitions[key] = parseHandlerDefinition(definition)
        level[key] = definitions[key].handler
        Object.setPrototypeOf(definition, Object.getPrototypeOf(level))
      }
    }
    definitionsByLevel.set(level, definitions)
  }
}

// Parse the definition of `values[key]` as given on the level that defines it:
export function getHandlerDefinition(values, key) {
  const level = getInheritanceChain(values).find(
    object => Object.hasOwn(object, key)
  )
  return getOwnHandlerDefinition(level, key)
}

// Collect the `authorize` settings of the handlers that `level` defines:
export function getOwnHandlerAuthorize(level) {
  const entries = Object.keys(level).map(
    key => [key, getOwnHandlerDefinition(level, key)?.authorize]
  )
  return Object.fromEntries(
    entries.filter(([, authorize]) => authorize != null)
  )
}

function getOwnHandlerDefinition(level, key) {
  return (
    definitionsByLevel.get(level)?.[key] ??
    parseHandlerDefinition(level[key])
  )
}

const definitionsByLevel = new WeakMap()
