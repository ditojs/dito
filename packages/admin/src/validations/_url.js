import { isUrl } from '@ditojs/utils'

export const url = {
  validate: value => isUrl(value),
  message: 'is not a valid URL'
}
