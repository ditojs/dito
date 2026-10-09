import { Validator } from './Validator.js'

describe('Validator.getKeyword()', () => {
  it('finds keywords registered with a leading underscore', () => {
    const validator = new Validator()
    expect(validator.getKeyword('instanceof')).toBe(
      validator.keywords._instanceof
    )
  })

  it('applies silent and message of underscore-prefixed keywords', () => {
    const validator = new Validator({
      keywords: {
        _quiet: { silent: true },
        _loud: { message: 'is too loud' }
      }
    })
    const errors = validator.parseErrors([
      { instancePath: '/a', keyword: 'quiet', message: 'quiet', params: {} },
      { instancePath: '/b', keyword: 'loud', message: 'loud', params: {} }
    ])
    expect(errors).toEqual({
      b: [{ message: 'is too loud', keyword: 'loud', params: {} }]
    })
  })
})

describe('Validator.getFormat()', () => {
  it('applies the message of underscore-prefixed formats', () => {
    const validator = new Validator({
      formats: { _even: { message: 'needs to be even' } }
    })
    const errors = validator.parseErrors([
      {
        instancePath: '/a',
        keyword: 'format',
        message: 'must match format "even"',
        params: { format: 'even' }
      }
    ])
    expect(errors).toEqual({
      a: [
        {
          message: 'needs to be even',
          keyword: 'format',
          params: { format: 'even' }
        }
      ]
    })
  })
})
