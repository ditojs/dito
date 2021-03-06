import { isArray, isObject } from '@ditojs/utils'
import { createDecorator, deprecate } from '@/utils'

export function parameters(parameters, options) {
  if (isObject(parameters)) {
    const first = parameters[Object.keys(parameters)[0]]
    if (!isObject(first)) {
      deprecate(
        `@parameters(${
          JSON.stringify(parameters)
        }) with parameter schema object is deprecated: Schema object should be passed nested inside an array or object definition.`
      )
      parameters = [...arguments]
    }
  }
  if (!isArray(parameters) && !isObject(parameters)) {
    throw new Error(`@parameters() need to be defined using array or object definitions`)
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
