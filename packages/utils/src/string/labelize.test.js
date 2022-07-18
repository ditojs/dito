import { labelize } from './labelize.js'

describe('labelize()', () => {
  it('should labelize hyphenated text', () => {
    expect(labelize('some-hyphenated-text')).toBe('Some Hyphenated Text')
  })

  it('should labelize underscored text', () => {
    expect(labelize('some_underscored_text')).toBe('Some Underscored Text')
  })

  it('should labelize camel-cased text', () => {
    expect(labelize('SomeCamelCasedText')).toBe('Some Camel Cased Text')
  })

  it('should labelize normal text', () => {
    expect(labelize('some normal text')).toBe('Some Normal Text')
  })

  it('should split numbers and words', () => {
    expect(labelize('one2')).toBe('One 2')
  })

  it('should split words and numbers both sides', () => {
    expect(labelize('one2three')).toBe('One 2 Three')
  })

  it('should keep multiple numbers together', () => {
    expect(labelize('one234five')).toBe('One 234 Five')
  })

  it('should return an empty string if nothing can be processed', () => {
    expect(labelize()).toBe('')
    expect(labelize(null)).toBe('')
    expect(labelize('')).toBe('')
  })
})
