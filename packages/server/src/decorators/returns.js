import { isObject } from '@ditojs/utils'
import { createDecorator } from '@/utils'

export function returns(returns, options) {
  if (!isObject(returns)) {
    throw new Error(
      `@returns(${
        JSON.stringify(returns)
      }) needs to be defined using an object parameter definition`
    )
  }

  return createDecorator(value => {
    value.returns = returns
    // If validation options are provided, expose them through
    // `handler.options.returns`, see ControllerAction
    if (options) {
      value.options ||= {}
      value.options.returns = options
    }
  })
}
