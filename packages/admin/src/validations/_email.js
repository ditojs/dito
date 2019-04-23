import { isEmail } from '@ditojs/utils'

export const email = {
  validate: value => isEmail(value),
  message: 'must be a valid email'
}
