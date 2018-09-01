import { createDecorator } from '@/utils'

export function returns(returns, options) {
  return createDecorator(value => {
    value.returns = returns
    // If validation options are provided, expose them through
    // `handler.options.returns`, see ControllerAction
    if (options) {
      value.options = value.options || {}
      value.options.returns = options
    }
  })
}
