import { isHostname } from '@ditojs/utils'

export const hostname = {
  validate: value => isHostname(value),
  getMessage: field => `The ${field} field is not a host name.`
}
