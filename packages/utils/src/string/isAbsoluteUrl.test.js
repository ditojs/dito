import { isAbsoluteUrl } from './isAbsoluteUrl.js'

describe('isAbsoluteUrl()', () => {
  it('should return true for absolute URLs starting with schemas', () => {
    expect(isAbsoluteUrl('http://example.com')).toBe(true)
    expect(isAbsoluteUrl('https://example.com')).toBe(true)
    expect(isAbsoluteUrl('ftp://example.com')).toBe(true)
    expect(isAbsoluteUrl('file:///Users/example')).toBe(true)
    expect(isAbsoluteUrl('mailto:user@example.com')).toBe(true)
    expect(isAbsoluteUrl('//example.com')).toBe(true)
    expect(isAbsoluteUrl('/static/index.html')).toBe(false)
    expect(isAbsoluteUrl('../index.html')).toBe(false)
    expect(isAbsoluteUrl('../static//index.html')).toBe(false)
  })
})
