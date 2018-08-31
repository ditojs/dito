import { createDecorator } from '@/utils'

export function validate(validate) {
  return createDecorator(value => {
    value.validate = validate
  })
}
