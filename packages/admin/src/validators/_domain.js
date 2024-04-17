import { isDomain } from '@ditojs/utils'

export const domain = {
  validate: value => isDomain(value),
  message: 'is not a domain'
}
