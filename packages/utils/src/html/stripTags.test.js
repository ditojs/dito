import { stripTags } from './stripTags.js'

describe('stripTags()', () => {
  it('should remove html tags from strings', () => {
    expect(stripTags('<p><b>this</b> is a marked-up string</p>'))
      .toBe('this is a marked-up string')
  })

  it('should return an empty string if nothing can be processed', () => {
    expect(stripTags()).toBe('')
    expect(stripTags(null)).toBe('')
    expect(stripTags('')).toBe('')
  })

  it('should handle falsy values correctly', () => {
    expect(stripTags(0)).toBe('0')
    expect(stripTags(false)).toBe('false')
  })
})
