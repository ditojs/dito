import { isHostname } from '@ditojs/utils'

export const hostname = {
  validate: value => isHostname(value),
  message: 'is not a host name'
}
