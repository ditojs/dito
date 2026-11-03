import { isDomain } from './isDomain.js'

describe('isDomain()', () => {
  it('should return true for domains', () => {
    expect(isDomain('example.com')).toBe(true)
    expect(isDomain('www.example.com')).toBe(true)
    expect(isDomain('www.example.ch')).toBe(true)
    expect(isDomain('sub2.sub1.example.com')).toBe(true)
    expect(isDomain('www.example.c')).toBe(false)
    expect(isDomain('example_com')).toBe(false)
    expect(isDomain('line-to.com')).toBe(true)
    expect(isDomain('line_to.com')).toBe(false)
    expect(isDomain('lünéto.com')).toBe(true)
  })

  it('should return false for anything beyond a domain', () => {
    expect(isDomain('')).toBe(false)
    expect(isDomain('example.com:80')).toBe(false)
    expect(isDomain('example.com/path')).toBe(false)
    expect(isDomain('user@example.com')).toBe(false)
    expect(isDomain('line%74o.com')).toBe(false)
    expect(isDomain('line to.com')).toBe(false)
  })

  it('should return false for hosts that `URL` rejects', () => {
    expect(isDomain('book[s].example.com')).toBe(false)
    expect(isDomain('book<s>.example.com')).toBe(false)
    expect(isDomain('book|s.example.com')).toBe(false)
  })
})
