import { createDecorator } from '../utils/index.js'

export const transacted = createDecorator(value => {
  value.transacted = true
})
