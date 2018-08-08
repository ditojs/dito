import { isHostName } from '@ditojs/utils'

export const hostname = {
  validate: value => isHostName(value),
  getMessage: field => `The ${field} field is not a host name.`
}
