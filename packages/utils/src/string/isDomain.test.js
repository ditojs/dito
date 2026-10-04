import { isDomain } from './isDomain.js'

describe('isDomain()', () => {
  it('should return true for domains', () => {
    expect(isDomain('lineto.com')).toBe(true)
    expect(isDomain('www.lineto.com')).toBe(true)
    expect(isDomain('www.lineto.ch')).toBe(true)
    expect(isDomain('sub2.sub1.lineto.com')).toBe(true)
    expect(isDomain('www.lineto.c')).toBe(false)
    expect(isDomain('lineto_com')).toBe(false)
    expect(isDomain('line-to.com')).toBe(true)
    expect(isDomain('line_to.com')).toBe(false)
    expect(isDomain('lünéto.com')).toBe(true)
  })

  it('should return false for anything beyond a domain', () => {
    expect(isDomain('')).toBe(false)
    expect(isDomain('lineto.com:80')).toBe(false)
    expect(isDomain('lineto.com/path')).toBe(false)
    expect(isDomain('user@lineto.com')).toBe(false)
    expect(isDomain('line%74o.com')).toBe(false)
    expect(isDomain('line to.com')).toBe(false)
  })
})
