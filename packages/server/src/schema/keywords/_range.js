import { keywords } from '@ditojs/schema'

const { validate, message } = keywords.range

export const range = {
  type: ['number', 'integer'],
  metaSchema: {
    type: 'array',
    prefixItems: [
      { type: 'number' },
      { type: 'number' }
    ],
    minItems: 2,
    items: false
  },
  errors: false,
  validate: (setting, value) => validate(value, setting),
  // Report the shared message of `@ditojs/schema` as Ajv's own:
  error: { message: ({ schema }) => message(schema) }
}
