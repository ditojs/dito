import { isArray, isObject } from '@ditojs/utils'
import { createDecorator } from '../utils/decorator.js'

export function parameters(parameters, options) {
  if (!isArray(parameters) && !isObject(parameters)) {
    throw new Error(
      `@parameters() need to be defined using array or object definitions`
    )
  }

  return createDecorator(value => {
    value.parameters = parameters
    // If validation options are provided, expose them through
    // `handler.options.parameters`, see ControllerAction
    if (options) {
      value.options ||= {}
      value.options.parameters = options
    }
  })
}
