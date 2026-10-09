import { isFunction, asArray, deprecate } from '@ditojs/utils'

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
    core = false,
    authorize = null,
    transacted = null,
    scope = null,
    parameters,
    // TODO: `returns` was deprecated in May 2025 in favour of `response`.
    // Remove this in 2026.
    returns,
    response = returns,
    options = {},
    ...extra
  } = isFunctionDefinition ? { ...definition } : definition

  if (returns || options.returns) {
    deprecate(
      'The `returns` property is deprecated in favour of `response`. ' +
      'Update your handler definition to use `response` instead.'
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
    core,
    authorize,
    transacted,
    scope: scope ? asArray(scope) : null,
    parameters: parametersSchema ?? null,
    response: responseSchema ?? null,
    options: {
      parameters: { ...options.parameters, ...parametersOptions },
      response: {
        ...options.returns,
        ...options.response,
        ...responseOptions
      }
    },
    extra
  }
}
