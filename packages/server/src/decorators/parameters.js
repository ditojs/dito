import { isArray } from '@ditojs/utils'
import { createDecorator } from '@/utils'

export function parameters(...args) {
  const array = isArray(args[0])
  const parameters = array ? args[0] : args
  const options = array ? args[1] : null
  return createDecorator(value => {
    value.parameters = parameters
    // If validation options are provided, expose them through
    // `handler.options.parameters`, see ControllerAction
    if (options) {
      value.options = value.options || {}
      value.options.parameters = options
    }
  })
}
