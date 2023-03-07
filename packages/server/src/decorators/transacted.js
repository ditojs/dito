import { createDecorator } from '../utils/decorator.js'

export const transacted = createDecorator(value => {
  value.transacted = true
})
