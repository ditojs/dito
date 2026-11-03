import * as validatorExports from './index.js'

const validators = { ...validatorExports }

function validate(name, value, setting, validations = {}) {
  return validators[name].validate(value, setting, validations)
}

function getMessage(name, setting, validations = {}) {
  const { message } = validators[name]
  return typeof message === 'function' ? message(setting, validations) : message
}

describe('validators', () => {
  it('exports all validators with `validate()`', () => {
    expect(Object.keys(validators).sort()).toEqual([
      'creditcard',
      'date',
      'decimals',
      'domain',
      'email',
      'enum',
      'hostname',
      'integer',
      'isoTime',
      'maxItems',
      'maxLength',
      'maximum',
      'minItems',
      'minLength',
      'minimum',
      'password',
      'pattern',
      'range',
      'required',
      'url',
      'validate'
    ])
    for (const validator of Object.values(validators)) {
      expect(validator.validate).toBeTypeOf('function')
    }
  })

  describe('required', () => {
    it('rejects `null`, `undefined` and empty strings', () => {
      // Only truthiness matters, see `getValueValidationErrors()`:
      expect(validate('required', null)).toBeFalsy()
      expect(validate('required', undefined)).toBeFalsy()
      expect(validate('required', '')).toBeFalsy()
      expect(getMessage('required')).toBe('is required')
    })

    it('accepts other falsy values and empty arrays, as the server', () => {
      expect(validate('required', 0)).toBe(true)
      expect(validate('required', false)).toBe(true)
      expect(validate('required', [])).toBe(true)
    })

    it('accepts unchanged passwords, which are `undefined`', () => {
      expect(validate('required', undefined, true, { password: true })).toBe(
        true
      )
      expect(validate('required', null, true, { password: true })).toBe(false)
      expect(validate('required', '', true, { password: true })).toBe(false)
    })
  })

  describe('password', () => {
    it('accepts any value', () => {
      expect(validate('password', '')).toBe(true)
      expect(validate('password', undefined)).toBe(true)
      expect(validators.password.message).toBe(undefined)
    })
  })

  describe.each([
    {
      name: 'minimum',
      setting: 5,
      valid: [5, 6.5, '1'],
      invalid: [4.9, -5],
      message: 'must be 5 or more'
    },
    {
      name: 'maximum',
      setting: 10,
      valid: [10, -1, '11'],
      invalid: [10.1, 100],
      message: 'must be 10 or less'
    },
    {
      name: 'range',
      setting: [-1, 1],
      valid: [-1, 0, 1, 'a'],
      invalid: [-1.1, 2],
      message: 'must be between -1 and 1'
    },
    {
      name: 'decimals',
      setting: 2,
      valid: ['1.25', 1.25, '-1.5', '+1', '.5'],
      invalid: ['1.255', '1.', '1,5', 'a', '-', '+', '.'],
      message: 'must be a number with at most 2 decimal places'
    },
    {
      name: 'decimals',
      setting: 8,
      valid: [1e-7, -1e-7],
      invalid: [1e-9],
      message: 'must be a number with at most 8 decimal places'
    },
    {
      name: 'decimals',
      setting: 1,
      valid: ['1.5', 2],
      invalid: ['1.25'],
      message: 'must be a number with at most one decimal place'
    },
    {
      name: 'decimals',
      setting: 0,
      valid: ['1', '-12', 3],
      invalid: ['1.5', 1.5],
      message: 'must be a whole number'
    },
    {
      name: 'decimals',
      setting: '*',
      valid: ['1.123456789', 1.125, 1e-7, 1e21],
      invalid: ['1.', '.'],
      message: 'must be a number'
    },
    {
      name: 'minLength',
      setting: 1,
      valid: ['a', 5],
      invalid: [''],
      message: 'must not be empty'
    },
    {
      // Two UTF-16 units, one code point:
      name: 'minLength',
      setting: 2,
      valid: ['ab', 'abc'],
      invalid: ['a', '😀'],
      message: 'must be at least 2 characters long'
    },
    {
      name: 'maxLength',
      setting: 1,
      valid: ['', 'a', '😀', ['a', 'b']],
      invalid: ['ab'],
      message: 'must be at most one character long'
    },
    {
      name: 'maxLength',
      setting: 3,
      valid: ['abc'],
      invalid: ['abcd'],
      message: 'must be at most 3 characters long'
    },
    {
      name: 'pattern',
      setting: '^[A-Z]+-\\d+$',
      valid: ['AB-12', 12],
      invalid: ['ab-12', ''],
      message: 'must match pattern "^[A-Z]+-\\d+$"'
    },
    {
      // Unicode property escapes need the `u` flag:
      name: 'pattern',
      setting: '^\\p{Lu}+$',
      valid: ['ÄB'],
      invalid: ['äb'],
      message: 'must match pattern "^\\p{Lu}+$"'
    },
    {
      name: 'minItems',
      setting: 2,
      valid: [['a', 'b'], 'abc'],
      invalid: [['a']],
      message: 'must contain at least 2 items'
    },
    {
      name: 'maxItems',
      setting: 1,
      valid: [[], ['a']],
      invalid: [['a', 'b']],
      message: 'must contain at most one item'
    },
    {
      name: 'maxItems',
      setting: 2,
      valid: [['a', 'b'], 'abc'],
      invalid: [['a', 'b', 'c']],
      message: 'must contain at most 2 items'
    }
  ])('$name with $setting', ({ name, setting, valid, invalid, message }) => {
    it.for(valid)('accepts %o', value => {
      expect(validate(name, value, setting)).toBe(true)
    })

    it.for(invalid)('rejects %o', value => {
      expect(validate(name, value, setting)).toBe(false)
    })

    it('describes the setting in the message', () => {
      expect(getMessage(name, setting)).toBe(message)
    })
  })

  describe('minItems', () => {
    it('validates the number of items of arrays', () => {
      expect(validate('minItems', ['a'], 1)).toBe(true)
      expect(validate('minItems', [], 1)).toBe(false)
      expect(getMessage('minItems', 1)).toBe('must contain at least one item')
    })

    it('says "is required" for one item of required fields', () => {
      expect(getMessage('minItems', 1, { required: true })).toBe('is required')
      expect(getMessage('minItems', 2, { required: true })).toBe(
        'must contain at least 2 items'
      )
    })
  })

  describe('integer', () => {
    it('accepts whole numbers only', () => {
      expect(validate('integer', 3)).toBe(true)
      expect(validate('integer', -3)).toBe(true)
      expect(validate('integer', 3.5)).toBe(false)
      expect(validate('integer', '1')).toBe(false)
      expect(validate('integer', Infinity)).toBe(false)
      expect(validate('integer', NaN)).toBe(false)
      expect(getMessage('integer')).toBe('must be a whole number')
    })
  })

  describe('format validators', () => {
    it.each([
      [
        'email', 'reader@example.com', 'reader@example', 'must be a valid email'
      ],
      ['url', 'https://example.com/books', 'books', 'is not a valid URL'],
      [
        'hostname', 'library.example.com', 'library example',
        'is not a host name'
      ],
      ['domain', 'example.com', 'example', 'is not a domain'],
      ['creditcard', '4111111111111111', '4111111111111112', 'is invalid'],
      ['isoTime', '14:30:00', '14:30', 'must be a valid time']
    ])('%s accepts %o and rejects %o', (name, valid, invalid, message) => {
      expect(validate(name, valid)).toBe(true)
      expect(validate(name, invalid)).toBe(false)
      expect(getMessage(name)).toBe(message)
    })

    it.for([
      '14:30:00',
      '00:00:00',
      '14:30:00.5',
      '14:30:00Z',
      '14:30:00+02:00',
      // Leap seconds, at the end of the day in UTC:
      '23:59:60Z',
      '22:59:60-01:00'
    ])('isoTime accepts %o', value => {
      expect(validate('isoTime', value)).toBe(true)
    })

    it.for([
      '14:30',
      '24:00:00',
      '14:60:00',
      '14:30:60',
      '14:30:00+24:00',
      '1:30:00',
      'noon'
    ])('isoTime rejects %o', value => {
      expect(validate('isoTime', value)).toBe(false)
    })

    it('accepts the dates that time fields edit as times', () => {
      expect(validate('isoTime', new Date(1970, 0, 1, 14, 30))).toBe(true)
      expect(validate('isoTime', new Date(NaN))).toBe(false)
    })

    it('requires a scheme in URLs, as the server does', () => {
      expect(validate('url', 'http://example.com')).toBe(true)
      expect(validate('url', 'example.com')).toBe(false)
      expect(validate('url', 'www.example.com/books')).toBe(false)
      expect(validate('url', '//example.com')).toBe(false)
    })
  })
})
