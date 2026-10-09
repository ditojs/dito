import { vi } from 'vitest'
import { stripHtml, stripTags } from './stripHtml.js'

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

describe('stripTags()', () => {
  let warn

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('should strip html like stripHtml()', () => {
    expect(stripTags('<p>Chapter <em>one</em></p><p>Two</p>')).toBe(
      'Chapter one\nTwo'
    )
    expect(stripTags(null)).toBe('')
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('deprecated in favour of `stripHtml`')
    )
  })

  it('should warn about its deprecation only once', () => {
    stripTags('<b>a</b>')
    stripTags('<b>b</b>')
    // The first test already triggered the single warning.
    expect(warn).not.toHaveBeenCalled()
  })
})
