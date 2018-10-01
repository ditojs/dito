import { createDecorator } from '@/utils'

export const transacted = createDecorator(value => {
  value.transacted = true
})
