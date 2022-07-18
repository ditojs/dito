import { asArray } from '@ditojs/utils'

export function processHandlerParameters(handler, name, value) {
  if (value) {
    const [schema, options] = asArray(value)
    handler[name] = schema

    // If validation options are provided, expose them through
    // `handler.options[name]`, see `ControllerAction`.
    if (options) {
      handler.options = {
        ...handler.options,
        [name]: options
      }
    }
  }
}
