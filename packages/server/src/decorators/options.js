import { createDecorator } from '@/utils'

export function options(options) {
  return createDecorator(value => {
    value.options = options
  })
}
