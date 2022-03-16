import { createDecorator } from '../utils/index.js'

export function authorize(authorize) {
  return createDecorator(value => {
    value.authorize = authorize
  })
}
