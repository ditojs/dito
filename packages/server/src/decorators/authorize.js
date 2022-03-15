import { createDecorator } from '../utils'

export function authorize(authorize) {
  return createDecorator(value => {
    value.authorize = authorize
  })
}
