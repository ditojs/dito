import { createDecorator } from '@/utils'

export function returns(returns) {
  return createDecorator(value => {
    value.returns = returns
  })
}
