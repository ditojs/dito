import { isArray } from '@ditojs/utils'
import { createDecorator } from '@/utils'

export function parameters(...args) {
  return createDecorator(value => {
    value.parameters = isArray(args[0]) ? args[0] : args
  })
}
