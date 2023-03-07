import { createDecorator } from '../utils/decorator.js'

export function action(method, path) {
  return createDecorator(value => {
    value.method = method
    value.path = path
  })
}
