import { createDecorator } from '../utils/decorator.js'

export function authorize(authorize) {
  return createDecorator(value => {
    value.authorize = authorize
  })
}
