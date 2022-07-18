import { createDecorator } from '../utils/index.js'

export function action(method, path) {
  return createDecorator(value => {
    value.method = method
    value.path = path
  })
}
