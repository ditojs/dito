import { keywords } from '@ditojs/schema'

// `integer: true` checks the type `integer` of the server:
export const integer = {
  validate: value => keywords.type.validate(value, 'integer'),
  message: keywords.type.message('integer')
}
