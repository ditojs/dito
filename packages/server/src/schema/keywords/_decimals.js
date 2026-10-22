import { keywords } from '@ditojs/schema'

const { validate, message } = keywords.decimals

export const decimals = {
  type: ['number', 'integer'],
  metaSchema: {
    anyOf: [
      { type: 'integer', minimum: 0 },
      { const: '*' }
    ]
  },
  errors: false,
  validate: (setting, value) => validate(value, setting),
  // Report the shared message of `@ditojs/schema` as Ajv's own:
  error: { message: ({ schema }) => message(schema) }
}
