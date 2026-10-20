import { formats, keywords } from './index.js'
import * as cases from './cases.js'

// Keywords that are reserved words are exported with a leading '_':
function getDefinition(definitions, name) {
  return definitions[name] ?? definitions[`_${name}`]
}

function getMessage({ message }, setting) {
  return typeof message === 'function' ? message(setting) : message
}

describe('formats', () => {
  it('has cases for all formats', () => {
    expect(Object.keys(cases.formats)).toEqual(Object.keys(formats))
  })

  describe.each(Object.entries(cases.formats))(
    '%s',
    (name, { valid, invalid, message }) => {
      const format = formats[name]
      // Formats don't apply to empty strings, as their engines register them,
      // unless they validate empty values themselves:
      const validate = value => (
        value === '' && !format.validatesEmptyValues ||
        format.validate(value)
      )

      it.for(valid)('accepts %o', value => {
        expect(validate(value)).toBe(true)
      })

      it.for(invalid)('rejects %o', value => {
        expect(validate(value)).toBe(false)
      })

      it('has a message', () => {
        expect(format.message).toBe(message)
      })
    }
  )
})

describe('keywords', () => {
  it('has cases for all keywords', () => {
    expect(
      Object.keys(cases.keywords).map(name => getDefinition(keywords, name))
    ).toEqual(Object.values(keywords))
  })

  describe.each(Object.entries(cases.keywords))('%s', (name, entries) => {
    const keyword = getDefinition(keywords, name)

    describe.each(entries)(
      'with %o',
      ({ setting, valid, invalid, message }) => {
        it.for(valid)('accepts %o', value => {
          expect(keyword.validate(value, setting)).toBe(true)
        })

        it.for(invalid)('rejects %o', value => {
          expect(keyword.validate(value, setting)).toBe(false)
        })

        it('describes the setting in the message', () => {
          expect(getMessage(keyword, setting)).toBe(message)
        })
      }
    )
  })
})
