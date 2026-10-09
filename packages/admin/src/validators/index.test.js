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
      'max',
      'min',
      'password',
      'range',
      'required',
      'url'
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

    it('accepts other falsy values', () => {
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

  describe('min, max and range', () => {
    it('validates inclusive limits', () => {
      expect(validate('min', 5, 5)).toBe(true)
      expect(validate('min', 4.9, 5)).toBe(false)
      expect(validate('max', 10, 10)).toBe(true)
      expect(validate('max', 10.1, 10)).toBe(false)
      expect(validate('range', 0, [0, 1])).toBe(true)
      expect(validate('range', 1, [0, 1])).toBe(true)
      expect(validate('range', -0.1, [0, 1])).toBe(false)
      expect(validate('range', 1.1, [0, 1])).toBe(false)
    })

    it('describes the limits in the messages', () => {
      expect(getMessage('min', 4, 5)).toBe('must be 5 or more')
      expect(getMessage('max', 11, 10)).toBe('must be 10 or less')
      expect(getMessage('range', 2, [-1, 1])).toBe('must be between -1 and 1')
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

    // Bug: `decimals: 0` creates the invalid regular expression `\d{1,0}` and
    // throws a SyntaxError instead of rejecting decimals.
    test.fails('rejects any decimals with `decimals: 0`', () => {
      expect(validate('decimals', '1', 0)).toBe(true)
      expect(validate('decimals', '1.5', 0)).toBe(false)
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
  })
})
