import { capitalize } from './capitalize.js'

describe('capitalize()', () => {
  it('should capitalize hyphenated text', () => {
    expect(capitalize('some-hyphenated-text')).toBe('Some-Hyphenated-Text')
  })

  it('should capitalize underscored text', () => {
    expect(capitalize('some_underscored_text')).toBe('Some_Underscored_Text')
  })

  it('should capitalize a camel-cased text', () => {
    expect(capitalize('someCamelCasedText')).toBe('SomeCamelCasedText')
  })

  it('should capitalize normal text', () => {
    expect(capitalize('some normal text')).toBe('Some Normal Text')
  })

  it('should consider numbers as word-breaks', () => {
    expect(capitalize('one234five')).toBe('One234Five')
  })

  it('should support umlauts', () => {
    expect(capitalize('mäuse häuschen')).toBe('Mäuse Häuschen')
  })

  it('should return an empty string if nothing can be processed', () => {
    expect(capitalize()).toBe('')
    expect(capitalize(null)).toBe('')
    expect(capitalize('')).toBe('')
  })
})
