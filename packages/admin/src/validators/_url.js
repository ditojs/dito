import { isAbsoluteUrl, isUrl } from '@ditojs/utils'

export const url = {
  // Require a scheme, as the server's `uri` format does:
  validate: value => isAbsoluteUrl(value) && isUrl(value),
  message: 'is not a valid URL'
}
