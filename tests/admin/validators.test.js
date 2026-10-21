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
      // Without `''` for `pattern`, see the differences below:
      values: [...new Set([...valid, ...invalid, ''])].filter(
        value => value !== '' || name !== 'pattern'
      )
    }))
  )
]

const validator = new Validator()

describe('The shared validation on both sides', () => {
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

// Where both sides differ: the server applies `pattern` to `''`, as JSON Schema
// does, while the admin skips empty values. Emptied fields send `null`:
describe('The differences between both sides', () => {
  it('rejects empty strings with `pattern` only on the server', () => {
    const pattern = '^[A-Z]+$'
    const validate = validator.compile(convertSchema({ pattern }), {
      throw: false
    })
    expect(validate('')).toBe(false)
    expect(getValueValidationErrors('', { pattern })).toEqual([])
  })
})

// The admin's `iso-time` agrees with the format of ajv-formats on the server,
// with its own message:
describe('The format `iso-time` on both sides', () => {
  const validate = validator.compile(convertSchema({ format: 'iso-time' }), {
    throw: false
  })

  it.for([
    '14:30:00',
    '00:00:00',
    '14:30:00.5',
    '14:30:00Z',
    '14:30:00+02:00',
    '23:59:60Z',
    '22:59:60-01:00',
    '14:30',
    '24:00:00',
    '14:60:00',
    '14:30:60',
    '14:30:00+24:00',
    '1:30:00',
    'noon'
  ])('agrees on %o', value => {
    expect(
      getValueValidationErrors(value, { isoTime: true }).length === 0
    ).toBe(
      validate(value)
    )
  })
})
