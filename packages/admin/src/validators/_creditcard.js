import { isCreditCard } from '@ditojs/utils'

export const creditcard = {
  validate: value => isCreditCard(value),
  message: 'is invalid'
}
