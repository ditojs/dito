import { Validator, convertSchema } from '@ditojs/server'
import * as cases from '../../packages/schema/src/cases.js'
import { getValueValidationErrors } from '../../packages/admin/src/utils/schema/validation.js'

// The shared cases that both sides validate: the server has no `decimals`, and
// the admin no `color`, `empty`, `multipleOf`, `enum` of values, and no `type`
// other than `integer`:
const keywordNames = [
  'minimum',
  'maximum',
  'range',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems'
]

const entries = [
  {
    name: 'required',
    validations: { required: true },
    schema: { format: 'required' },
    message: cases.formats.required.message,
    // Ajv applies formats only to strings, and leaves other values to the type:
    values: [
      ...cases.formats.required.valid,
      ...cases.formats.required.invalid
    ].filter(value => typeof value === 'string')
  },
  ...cases.keywords.type
    .filter(({ setting }) => setting === 'integer')
    .map(({ valid, invalid, message }) => ({
      name: 'integer',
      validations: { integer: true },
      schema: { type: 'integer' },
      message,
      // Without `''`, as the empty value of number fields is `null`:
      values: [...valid, ...invalid]
    })),
  ...keywordNames.flatMap(name =>
    cases.keywords[name].map(({ setting, valid, invalid, message }) => ({
      name,
      validations: { [name]: setting },
      schema: { [name]: setting },
      message,
      values: [...new Set([...valid, ...invalid, ''])]
    }))
  )
]

describe('The shared validation on both sides', () => {
  const validator = new Validator()

  describe.each(entries)(
    '$name with $schema',
    ({ validations, schema, message, values }) => {
      // Dito.js schemas, as the admin's properties compile to:
      const validate = validator.compile(convertSchema(schema), {
        throw: false
      })

      it.for(values)('agrees on %o', value => {
        expect(
          getValueValidationErrors(value, validations).map(
            ({ message }) => message
          )
        ).toEqual(validate(value) ? [] : [message])
      })
    }
  )
})
