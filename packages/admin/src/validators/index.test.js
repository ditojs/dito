import * as validatorExports from './index.js'

const validators = { ...validatorExports }

function validate(name, value, setting, validations = {}) {
  return validators[name].validate(value, setting, validations)
}

function getMessage(name, value, setting, validations = {}) {
  const { message } = validators[name]
  return typeof message === 'function'
    ? message(value, setting, validations)
    : message
}

describe('validators', () => {
  it('exports all validators with `validate()`', () => {
    expect(Object.keys(validators).sort()).toEqual([
      'creditcard',
      'decimals',
      'domain',
      'email',
      'hostname',
      'integer',
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

  describe('minimum, maximum and range', () => {
    it('validates inclusive limits', () => {
      expect(validate('minimum', 5, 5)).toBe(true)
      expect(validate('minimum', 4.9, 5)).toBe(false)
      expect(validate('maximum', 10, 10)).toBe(true)
      expect(validate('maximum', 10.1, 10)).toBe(false)
      expect(validate('range', 0, [0, 1])).toBe(true)
      expect(validate('range', 1, [0, 1])).toBe(true)
      expect(validate('range', -0.1, [0, 1])).toBe(false)
      expect(validate('range', 1.1, [0, 1])).toBe(false)
    })

    it('describes the limits in the messages', () => {
      expect(getMessage('minimum', 4, 5)).toBe('must be 5 or more')
      expect(getMessage('maximum', 11, 10)).toBe('must be 10 or less')
      expect(getMessage('range', 2, [-1, 1])).toBe('must be between -1 and 1')
    })
  })

  describe('minLength, maxLength and pattern', () => {
    it('validates the length of strings in code points', () => {
      expect(validate('minLength', 'ab', 2)).toBe(true)
      expect(validate('minLength', 'a', 2)).toBe(false)
      expect(validate('minLength', '', 1)).toBe(false)
      expect(validate('maxLength', 'ab', 2)).toBe(true)
      expect(validate('maxLength', 'abc', 2)).toBe(false)
      // Two UTF-16 units, one code point:
      expect(validate('maxLength', '😀', 1)).toBe(true)
      expect(validate('minLength', '😀', 2)).toBe(false)
    })

    it('validates strings against patterns', () => {
      expect(validate('pattern', 'AB-12', '^[A-Z]+-\\d+$')).toBe(true)
      expect(validate('pattern', 'ab-12', '^[A-Z]+-\\d+$')).toBe(false)
    })

    it(`ignores values that aren't strings, as the server`, () => {
      expect(validate('minLength', 5, 2)).toBe(true)
      expect(validate('maxLength', ['a', 'b', 'c'], 2)).toBe(true)
      expect(validate('pattern', 12, '^[A-Z]+$')).toBe(true)
    })

    it('describes the limits in the messages', () => {
      expect(getMessage('minLength', '', 1)).toBe('must not be empty')
      expect(getMessage('minLength', 'a', 3)).toBe(
        'must be at least 3 characters long'
      )
      expect(getMessage('maxLength', 'ab', 1)).toBe(
        'must be at most one character long'
      )
      expect(getMessage('maxLength', 'abcd', 3)).toBe(
        'must be at most 3 characters long'
      )
      expect(getMessage('pattern', 'a', '^\\d+$')).toBe(
        'must match pattern "^\\d+$"'
      )
    })
  })

  describe('minItems and maxItems', () => {
    it('validates the number of items of arrays', () => {
      expect(validate('minItems', ['a'], 1)).toBe(true)
      expect(validate('minItems', [], 1)).toBe(false)
      expect(validate('maxItems', ['a', 'b'], 2)).toBe(true)
      expect(validate('maxItems', ['a', 'b', 'c'], 2)).toBe(false)
      expect(validate('minItems', 'abc', 5)).toBe(true)
    })

    it('describes the limits in the messages', () => {
      expect(getMessage('minItems', [], 1)).toBe(
        'must contain at least one item'
      )
      expect(getMessage('minItems', [], 2)).toBe(
        'must contain at least 2 items'
      )
      expect(getMessage('maxItems', [1, 2], 1)).toBe(
        'must contain at most one item'
      )
      expect(getMessage('maxItems', [1, 2, 3], 2)).toBe(
        'must contain at most 2 items'
      )
    })

    it('says "is required" for one item of required fields', () => {
      expect(getMessage('minItems', [], 1, { required: true })).toBe(
        'is required'
      )
      expect(getMessage('minItems', [], 2, { required: true })).toBe(
        'must contain at least 2 items'
      )
    })
  })

  describe('integer', () => {
    it('accepts whole numbers only', () => {
      expect(validate('integer', 3)).toBe(true)
      expect(validate('integer', -3)).toBe(true)
      expect(validate('integer', 3.5)).toBe(false)
      expect(getMessage('integer')).toBe('must be whole number')
    })
  })

  describe('decimals', () => {
    it('limits the number of decimals', () => {
      expect(validate('decimals', '1.25', 2)).toBe(true)
      expect(validate('decimals', 1.25, 2)).toBe(true)
      expect(validate('decimals', '-1.5', 2)).toBe(true)
      expect(validate('decimals', '+1', 2)).toBe(true)
      expect(validate('decimals', '.5', 2)).toBe(true)
      expect(validate('decimals', '1.255', 2)).toBe(false)
      expect(validate('decimals', '1.', 2)).toBe(false)
      expect(validate('decimals', '1,5', 2)).toBe(false)
      expect(validate('decimals', 'a', 2)).toBe(false)
    })

    it(`allows any number of decimals with '*'`, () => {
      expect(validate('decimals', '1.123456789', '*')).toBe(true)
      expect(validate('decimals', '1.', '*')).toBe(false)
    })

    it('describes the number of decimals in the message', () => {
      expect(getMessage('decimals', '1.255', 2)).toBe(
        'must be numeric and may contain 2 decimal points'
      )
    })

    it('rejects any decimals with `decimals: 0`', () => {
      expect(validate('decimals', '1', 0)).toBe(true)
      expect(validate('decimals', '-12', 0)).toBe(true)
      expect(validate('decimals', '1.5', 0)).toBe(false)
      expect(getMessage('decimals', '1.5', 0)).toBe(
        'must be numeric and may not contain decimal points'
      )
    })

    it(`describes any number of decimals without a double space`, () => {
      const message = 'must be numeric and may contain decimal points'
      expect(getMessage('decimals', 'a', '*')).toBe(message)
      expect(getMessage('decimals', 'a')).toBe(message)
    })

    it('allows any number of decimals when unset', () => {
      expect(validate('decimals', '1.123456789')).toBe(true)
      expect(validate('decimals', '1.')).toBe(false)
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
      ['creditcard', '4111111111111111', '4111111111111112', 'is invalid']
    ])('%s accepts %o and rejects %o', (name, valid, invalid, message) => {
      expect(validate(name, valid)).toBe(true)
      expect(validate(name, invalid)).toBe(false)
      expect(getMessage(name, invalid)).toBe(message)
    })

    it('requires a scheme in URLs, as the server does', () => {
      expect(validate('url', 'http://example.com')).toBe(true)
      expect(validate('url', 'example.com')).toBe(false)
      expect(validate('url', 'www.example.com/books')).toBe(false)
      expect(validate('url', '//example.com')).toBe(false)
    })
  })
})
