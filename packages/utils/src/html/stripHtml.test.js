import { stripHtml } from './stripHtml.js'

describe('stripHtml()', () => {
  it('should remove html tags from strings', () => {
    expect(stripHtml('<p><b>this</b> is a marked-up string</p>'))
      .toBe('this is a marked-up string')
  })

  it('should return an empty string if nothing can be processed', () => {
    expect(stripHtml()).toBe('')
    expect(stripHtml(null)).toBe('')
    expect(stripHtml('')).toBe('')
  })

  it('should handle falsy values correctly', () => {
    expect(stripHtml(0)).toBe('0')
    expect(stripHtml(false)).toBe('false')
  })

  it('should convert <br> tags to line-breaks', () => {
    expect(stripHtml('hello<br>world')).toBe('hello\nworld')
    expect(stripHtml('hello<br/>world')).toBe('hello\nworld')
    expect(stripHtml('hello<br />world')).toBe('hello\nworld')
  })

  it('should convert <p> tags to line-breaks', () => {
    expect(stripHtml('<p>First paragraph</p><p>Second paragraph</p>'))
      .toBe('First paragraph\nSecond paragraph')
    expect(stripHtml('<p>Only paragraph</p>'))
      .toBe('Only paragraph')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(stripHtml('  <p>text</p>  ')).toBe('text')
    expect(stripHtml('<p>  text  </p>')).toBe('text')
  })
})
