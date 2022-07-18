import { isAbsoluteUrl } from './isAbsoluteUrl.js'

describe('isAbsoluteUrl()', () => {
  it('should return true for absolute URLs starting with schemas', () => {
    expect(isAbsoluteUrl('http://lineto.com')).toBe(true)
    expect(isAbsoluteUrl('https://lineto.com')).toBe(true)
    expect(isAbsoluteUrl('ftp://lineto.com')).toBe(true)
    expect(isAbsoluteUrl('file:///Users/lineto')).toBe(true)
    expect(isAbsoluteUrl('//lineto.com')).toBe(true)
    expect(isAbsoluteUrl('/static/index.html')).toBe(false)
    expect(isAbsoluteUrl('../index.html')).toBe(false)
  })
})
