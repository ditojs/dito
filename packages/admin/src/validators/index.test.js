import { keywords } from '@ditojs/schema'
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

  it('takes the keywords from @ditojs/schema', () => {
    for (const name of [
      'decimals',
      'maxItems',
      'maxLength',
      'maximum',
      'minLength',
      'minimum',
      'pattern',
      'range'
    ]) {
      expect(validators[name]).toBe(keywords[name])
    }
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
