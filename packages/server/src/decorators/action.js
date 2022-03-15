import { createDecorator } from '../utils'

export function action(method, path) {
  return createDecorator(value => {
    value.method = method
    value.path = path
  })
}
